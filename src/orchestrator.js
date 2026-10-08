import { loadWorkspace } from '../plugins/core/_lib/workspace.mjs';
import {
  checkAll,
  createCalleeSettings,
  createConfig,
  createDraftsDir,
} from '../plugins/core/skills/coding-orchestrator/scripts/config.mjs';
import { install, isInstalled, RELOAD_NOTICE } from './install.js';
import { sync } from './workspace.js';

/**
 * ハブ（.code-workspace に対象リポジトリが並ぶフォルダ）の準備。
 * ハブは新しく作るフォルダなので、init の1コマンドで使い始められるよう、導入と sync もここで行う。
 * 戻り値は失敗したときの終了コード。成功したら null。
 */
async function prepareHub(targetDir) {
  if (isInstalled(targetDir)) {
    console.log('- ai-doc の導入: 導入済み');
  } else {
    console.log('ai-doc を導入します');
    const code = await install(targetDir, { notice: false });
    if (code !== 0) return code;
  }
  console.log('');
  const code = sync(targetDir, { notice: false });
  return code === 0 ? null : code;
}

/**
 * coding-orchestrator の設定ファイルを作る。
 * 雛形の内容はスキル側の config.mjs に一本化し、ここでは人向けの表示だけを行う。
 * ハブで実行したときは、ai-doc の導入と aidoc workspace sync もまとめて行う。
 */
export async function init(targetDir) {
  const workspace = loadWorkspace(targetDir);
  if (!workspace.ok) {
    console.error('.code-workspace に問題があります:');
    for (const error of workspace.errors) console.error(`- ${error}`);
    return 1;
  }
  const isHub = workspace.mode === 'multi';
  if (isHub) {
    const code = await prepareHub(targetDir);
    if (code !== null) return code;
    console.log('');
  }

  const result = createConfig(targetDir);
  console.log(result.created
    ? `- 設定ファイル: 作成: ${result.configPath}`
    : `- 設定ファイル: 作成済み（上書きしません）: ${result.configPath}`);
  // オーケストレーターが呼ぶ Issue・PR 作成スキルの設定も、ここで雛形を用意する
  for (const callee of createCalleeSettings(targetDir)) {
    console.log(callee.created
      ? `- ${callee.skill} の設定ファイル: 作成: ${callee.settingsPath}`
      : `- ${callee.skill} の設定ファイル: 作成済み（上書きしません）: ${callee.settingsPath}`);
  }
  const drafts = createDraftsDir(targetDir);
  console.log(`- 下書き置き場: ${drafts.created ? '作成' : '作成済み'}: ${drafts.dir}`);
  if (result.created) {
    console.log(
      '\nプロジェクト独自の規約を読ませたい場合は、implementation.docs と review.docs' +
        (isHub ? '（特定のリポジトリだけなら repos）' : '') +
        ' に規約ファイルを追加してください。' +
        '\nIssue・PR の本文のテンプレートや規約は、create-gh-issue・create-gh-pr の設定ファイルに書きます。' +
        '\n編集したら aidoc orchestrator check で設定を検証してください。',
    );
  }
  if (isHub) console.log(RELOAD_NOTICE);
  return 0;
}

/**
 * coding-orchestrator の設定ファイルを検証する。
 * 判定はスキルの起動時と同じ checkAll で行うので、呼び出し先スキル（Issue・PR 作成）の設定も検証される。
 */
export function check(targetDir) {
  const report = checkAll(targetDir);
  if (report.ok) {
    console.log(`設定に問題はありません: ${report.configPath}`);
    return 0;
  }

  if (report.reason === 'not-initialized') {
    console.error(`設定ファイルがありません: ${report.configPath}`);
    console.error('aidoc orchestrator init で作成してください。');
    return 1;
  }

  console.error(`設定に問題があります: ${report.configPath}`);
  for (const error of report.errors) {
    console.error(`- ${error}`);
  }
  return 1;
}

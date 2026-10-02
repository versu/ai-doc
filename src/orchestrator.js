import {
  checkAll,
  createConfig,
} from '../plugins/core/skills/coding-orchestrator/scripts/config.mjs';

/**
 * coding-orchestrator の設定ファイルを作る。
 * 雛形の内容はスキル側の config.mjs に一本化し、ここでは人向けの表示だけを行う。
 */
export function init(targetDir) {
  const result = createConfig(targetDir);
  if (!result.created) {
    console.log(`- 設定ファイル: 作成済み（上書きしません）: ${result.configPath}`);
    return 0;
  }

  console.log(`- 設定ファイル: 作成: ${result.configPath}`);
  console.log(
    '\n次に、implementation.docs と review.docs にプロジェクトの規約ファイルを追加し、' +
      '\naidoc orchestrator check で設定を検証してください。',
  );
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

import fs from 'node:fs';
import path from 'node:path';
import { installedPluginIds, runClaude, tryRunClaude } from './claude-cli.js';
import { addGitLocalExclude } from './git-exclude.js';
import { ensureDirLink, removeDirLink } from './link.js';
import { AIDOC_ROOT, DOCS_DIR, MARKETPLACE_FILE, MARKETPLACE_NAME, PLUGIN_ID } from './paths.js';
import { confirm } from './prompt.js';
import { readSettings, writeSettings } from './settings.js';

const EXCLUDE_DIRECTORIES = ['.ai'];

/** 導入先の settings.local.json へ、値が未設定の場合だけ入れる既定値 */
const DEFAULT_SETTINGS = { language: 'japanese' };

function docsLinkPathOf(targetDir) {
  return path.join(targetDir, '.ai', '_docs');
}

/** スキルが _docs のガイドを読み込めるよう、ai-doc へのファイルアクセスを許可する */
function allowAidocAccess(targetDir) {
  const settings = readSettings(targetDir);
  const directories = settings.permissions?.additionalDirectories ?? [];
  if (directories.includes(AIDOC_ROOT)) {
    console.log('- ai-doc へのファイルアクセス許可: 追加済み');
    return;
  }

  settings.permissions = {
    ...settings.permissions,
    additionalDirectories: [...directories, AIDOC_ROOT],
  };
  writeSettings(targetDir, settings);
  console.log('- ai-doc へのファイルアクセス許可: 追加');
}

/** プロジェクト固有の設定を壊さないよう、未設定のキーだけを補う */
function applyDefaultSettings(targetDir) {
  const settings = readSettings(targetDir);
  const missing = Object.entries(DEFAULT_SETTINGS).filter(([key]) => settings[key] === undefined);
  if (missing.length === 0) {
    console.log('- 既定の設定: 設定済み');
    return;
  }

  writeSettings(targetDir, { ...settings, ...Object.fromEntries(missing) });
  console.log(`- 既定の設定を追加: ${missing.map(([key, value]) => `${key}=${value}`).join(', ')}`);
}

/** カタログに載せた外部プラグイン（他者が公開しているもの）の一覧 */
function externalPlugins() {
  const catalog = JSON.parse(fs.readFileSync(MARKETPLACE_FILE, 'utf8'));
  return catalog.plugins.filter((plugin) => plugin.category === 'external');
}

/**
 * 外部プラグインのうち未導入のものを、確認のうえユーザースコープで導入する。
 * プロジェクトごとに要否が変わるものではないため、スコープはユーザー単位とする。
 * 非対話実行や、利用者が断った場合は導入しない。
 */
async function installExternalPlugins(targetDir) {
  const installed = installedPluginIds(targetDir);

  for (const plugin of externalPlugins()) {
    const pluginId = `${plugin.name}@${MARKETPLACE_NAME}`;
    if (installed.includes(pluginId)) {
      console.log(`- 外部プラグイン ${pluginId}: 導入済み`);
      continue;
    }

    console.log(`\n外部プラグイン ${pluginId}: ${plugin.description}`);
    if (!(await confirm('ユーザースコープで導入しますか？'))) {
      console.log(`- 外部プラグイン ${pluginId}: 導入を見送りました`);
      continue;
    }
    if (!tryRunClaude(['plugin', 'install', pluginId, '--scope', 'user'], targetDir)) {
      console.warn(`警告: ${pluginId} の導入に失敗しました（手動で導入してください）`);
    }
  }
}

export async function install(targetDir) {
  // マーケットプレイスとプラグインを、このプロジェクト限定（local スコープ）で登録する
  if (readSettings(targetDir).extraKnownMarketplaces?.[MARKETPLACE_NAME]) {
    console.log('- マーケットプレイス: 登録済み');
  } else {
    runClaude(['plugin', 'marketplace', 'add', AIDOC_ROOT, '--scope', 'local'], targetDir);
  }
  runClaude(['plugin', 'install', PLUGIN_ID, '--scope', 'local'], targetDir);

  allowAidocAccess(targetDir);
  applyDefaultSettings(targetDir);

  fs.mkdirSync(path.join(targetDir, '.ai', '_tasks', '_done'), { recursive: true });
  console.log('- .ai/_tasks/_done: 作成');

  const docsLink = ensureDirLink(docsLinkPathOf(targetDir), DOCS_DIR);
  if (docsLink === 'conflict') {
    console.warn('警告: .ai/_docs が実ディレクトリとして存在するため、リンクを作成しませんでした');
  } else {
    console.log(`- .ai/_docs リンク: ${docsLink}`);
  }

  addGitLocalExclude(targetDir, EXCLUDE_DIRECTORIES);

  await installExternalPlugins(targetDir);

  console.log(
    '\n※ 実行中の Claude Code セッションには反映されません。セッションを開き直してください' +
      '\n　（VS Code 拡張の場合はウィンドウの再読み込み。/reload-plugins では反映されません）',
  );

  return docsLink === 'conflict' ? 1 : 0;
}

/**
 * 外部プラグインを最新化する。
 * 自作プラグインは ai-doc のフォルダを直接読むため、この操作は不要（git pull で反映される）。
 */
export function update(targetDir) {
  runClaude(['plugin', 'marketplace', 'update', MARKETPLACE_NAME], targetDir);

  const installed = installedPluginIds(targetDir);
  for (const plugin of externalPlugins()) {
    const pluginId = `${plugin.name}@${MARKETPLACE_NAME}`;
    if (!installed.includes(pluginId)) {
      console.log(`- 外部プラグイン ${pluginId}: 未導入のためスキップ（aidoc install で導入できます）`);
      continue;
    }
    if (!tryRunClaude(['plugin', 'update', pluginId], targetDir)) {
      console.warn(`警告: ${pluginId} の更新に失敗しました`);
    }
  }

  return 0;
}

export function uninstall(targetDir) {
  // 既に解除済み・未導入でも、残りの後始末は続ける
  tryRunClaude(['plugin', 'uninstall', PLUGIN_ID, '--scope', 'local'], targetDir);

  // マーケットプレイスの解除はマシン全体に効き、そこから導入したプラグイン（他プロジェクトの分や
  // ユーザースコープの外部プラグイン）も一緒に消えるため、導入が残っている間は解除しない
  const remaining = installedPluginIds(targetDir).filter((id) => id.endsWith(`@${MARKETPLACE_NAME}`));
  if (remaining.length === 0) {
    tryRunClaude(['plugin', 'marketplace', 'remove', MARKETPLACE_NAME], targetDir);
  } else {
    console.log(`- マーケットプレイス: 解除しません（${remaining.join(', ')} が導入されたままのため）`);
  }

  const settings = readSettings(targetDir);
  const directories = settings.permissions?.additionalDirectories;
  if (directories?.includes(AIDOC_ROOT)) {
    settings.permissions.additionalDirectories = directories.filter((dir) => dir !== AIDOC_ROOT);
    writeSettings(targetDir, settings);
    console.log('- ai-doc へのファイルアクセス許可: 削除');
  }

  if (removeDirLink(docsLinkPathOf(targetDir))) {
    console.log('- .ai/_docs リンク: 削除');
  }

  console.log('※ .ai/_tasks と Git ローカル除外設定は、作業内容が残るため削除していません');
  console.log(`※ プラグインのキャッシュ（~/.claude/plugins/cache/${MARKETPLACE_NAME}）は残ります。不要なら削除してください`);

  return 0;
}

import fs from 'node:fs';
import path from 'node:path';
import { loadWorkspace } from '../plugins/core/_lib/workspace.mjs';
import { RELOAD_NOTICE } from './install.js';
import { readSettings, writeSettings } from './settings.js';

/** ハブの CLAUDE.md に追記する案内の見出し。追記済みかの判定にも使う */
const GUIDE_HEADING = '## ワークスペースの各リポジトリの規約';

/**
 * 各リポジトリの規約の場所と、読むタイミングの案内。
 * ハブで開いたセッションでは、対象リポジトリの CLAUDE.md と rules が自動では読まれないため。
 * リポジトリ名を含まない定型文にして、リポジトリを増減しても書き直さなくて済むようにしている。
 */
function guideOf(workspaceFileName) {
  return `${GUIDE_HEADING}

このフォルダは複数リポジトリを横断するハブ。対象のリポジトリは ${workspaceFileName} の folders を参照する。
あるリポジトリのファイルを読み書きする前に、そのリポジトリの次の規約を読み、そのリポジトリの中でだけ従う。

- \`CLAUDE.md\`、\`.claude/CLAUDE.md\`
- \`.claude/rules/**/*.md\`
`;
}

/** 対象リポジトリへのファイルアクセスを許可する。.code-workspace から外したリポジトリの許可は取り除かない */
function allowRepoAccess(hubRoot, repos) {
  const settings = readSettings(hubRoot);
  const directories = settings.permissions?.additionalDirectories ?? [];
  const missing = repos.filter((dir) => !directories.includes(dir));
  if (missing.length === 0) {
    console.log('- 対象リポジトリへのファイルアクセス許可: 追加済み');
    return;
  }

  settings.permissions = { ...settings.permissions, additionalDirectories: [...directories, ...missing] };
  writeSettings(hubRoot, settings);
  console.log(`- 対象リポジトリへのファイルアクセス許可を追加: ${missing.join(', ')}`);
}

function addGuide(hubRoot, workspaceFile) {
  const claudeMd = path.join(hubRoot, 'CLAUDE.md');
  const existing = fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, 'utf8') : '';
  if (existing.split(/\r?\n/).includes(GUIDE_HEADING)) {
    console.log('- CLAUDE.md の案内: 追記済み');
    return;
  }

  const separator = existing === '' ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(claudeMd, `${existing}${separator}${guideOf(path.basename(workspaceFile))}`);
  console.log(`- CLAUDE.md に各リポジトリの規約の案内を${existing === '' ? '作成' : '追記'}`);
}

/**
 * ハブを .code-workspace に合わせる。.code-workspace にリポジトリを足したとき、パスを変えたときに実行する。
 * @param notice 最後にセッションの開き直しを案内するか。ほかのコマンドから続けて呼ぶときは、呼び出し側でまとめて案内する
 */
export function sync(targetDir, { notice = true } = {}) {
  const workspace = loadWorkspace(targetDir);
  if (!workspace.ok) {
    console.error('ワークスペースの設定に問題があります:');
    for (const error of workspace.errors) console.error(`- ${error}`);
    return 1;
  }
  if (workspace.mode === 'single') {
    console.error(
      workspace.workspaceFile
        ? `${workspace.workspaceFile} に、ハブ以外の git リポジトリが並んでいません。folders に対象リポジトリを追加してください。`
        : `${workspace.hubRoot} に .code-workspace がありません。ハブのフォルダで実行してください。`,
    );
    return 1;
  }

  console.log(`対象リポジトリ（${path.basename(workspace.workspaceFile)} から）:`);
  for (const [key, repo] of Object.entries(workspace.repos)) console.log(`  ${key}: ${repo.resolved}`);

  allowRepoAccess(workspace.hubRoot, Object.values(workspace.repos).map((repo) => repo.resolved));
  addGuide(workspace.hubRoot, workspace.workspaceFile);

  if (notice) console.log(RELOAD_NOTICE);
  return 0;
}

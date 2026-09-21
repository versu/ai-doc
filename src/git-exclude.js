import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function runGit(args, cwd) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

/** 前後のスラッシュの有無だけが違うエントリを同一とみなすための正規化 */
function normalize(entry) {
  return entry.replace(/^\/+|\/+$/g, '');
}

/**
 * Git のローカル除外設定（.git/info/exclude）に、不足しているエントリを追記する。
 *
 * Git 管理外のディレクトリや git が無い環境でも導入自体は続けられるよう、
 * 追記できない場合は警告を表示して何もしない。
 */
export function addGitLocalExclude(targetDir, directories) {
  const toplevel = runGit(['rev-parse', '--show-toplevel'], targetDir);
  if (toplevel.status !== 0) {
    console.warn('- Git ローカル除外設定: Git リポジトリではないためスキップ');
    return;
  }
  const repoRoot = toplevel.stdout.trim();

  // worktree では除外設定が共通ディレクトリ側に置かれるため --git-common-dir を使う
  const commonDirResult = runGit(['rev-parse', '--git-common-dir'], targetDir);
  if (commonDirResult.status !== 0) {
    console.warn('- Git ローカル除外設定: 共通ディレクトリを特定できないためスキップ');
    return;
  }
  const commonDir = path.resolve(targetDir, commonDirResult.stdout.trim());
  const excludeFile = path.join(commonDir, 'info', 'exclude');

  // リポジトリのサブディレクトリに導入した場合でも正しく除外されるよう、ルートからの位置を前置する
  const relative = path.relative(repoRoot, targetDir).split(path.sep).join('/');
  const prefix = relative === '' ? '' : `${relative}/`;
  const entries = directories.map((directory) => `/${prefix}${normalize(directory)}/`);

  // プロジェクト固有設定が誤ってコミットされないよう、未除外の場合は併せて除外する
  const settingsPath = '.claude/settings.local.json';
  if (runGit(['check-ignore', '-q', settingsPath], targetDir).status !== 0) {
    entries.push(`/${prefix}${settingsPath}`);
  }

  const existing = fs.existsSync(excludeFile) ? fs.readFileSync(excludeFile, 'utf8') : '';
  const existingEntries = new Set(existing.split(/\r?\n/).map((line) => normalize(line.trim())));
  const missing = entries.filter((entry) => !existingEntries.has(normalize(entry)));
  if (missing.length === 0) {
    console.log('- Git ローカル除外設定: 追記済み');
    return;
  }

  try {
    fs.mkdirSync(path.dirname(excludeFile), { recursive: true });
    const separator = existing === '' || existing.endsWith('\n') ? '' : '\n';
    fs.appendFileSync(excludeFile, `${separator}${missing.join('\n')}\n`);
    console.log(`- Git ローカル除外設定に追記: ${missing.join(', ')}`);
  } catch (e) {
    console.warn(`- Git ローカル除外設定: 追記に失敗したためスキップ（${e.message}）`);
  }
}

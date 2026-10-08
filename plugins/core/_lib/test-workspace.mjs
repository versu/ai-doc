/**
 * テスト用に、ハブ（git 管理外）と対象リポジトリを並べた一時フォルダを作る。
 * workspace.mjs・config.mjs・state.mjs のテストで共有する。
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function initRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
  return dir;
}

/**
 * root/hub と、repos に挙げた名前の git リポジトリを root/ の下に作り、hub/ws.code-workspace を書く。
 * folders を渡せばそのまま書き、渡さなければハブ自身と各リポジトリを並べる。workspace に null を渡すと書かない。
 * 既定では aidoc workspace sync 済みの状態（各リポジトリへのファイルアクセスを許可）にする。synced: false で外せる。
 */
export function withWorkspace(fn, { repos = ['api', 'web'], folders, workspace, synced = true } = {}) {
  // macOS の /var は /private/var へのリンクで、git はリンクを解決したパスを返すため、最初から解決しておく
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-')));
  try {
    const hub = path.join(root, 'hub');
    fs.mkdirSync(hub);
    const repoPaths = Object.fromEntries(repos.map((name) => [name, initRepo(path.join(root, name))]));
    const content = workspace !== undefined ? workspace : JSON.stringify({ folders: folders ?? [{ path: '.' }, ...repos.map((name) => ({ path: `../${name}` }))] });
    if (content !== null) fs.writeFileSync(path.join(hub, 'ws.code-workspace'), content);
    if (synced) {
      fs.mkdirSync(path.join(hub, '.claude'));
      const settings = { permissions: { additionalDirectories: Object.values(repoPaths) } };
      fs.writeFileSync(path.join(hub, '.claude', 'settings.local.json'), JSON.stringify(settings));
    }
    return fn({ root, hub, repos: repoPaths });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

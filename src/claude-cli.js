import { spawnSync } from 'node:child_process';

function spawnClaude(args, cwd) {
  const result = spawnSync('claude', args, {
    cwd,
    stdio: 'inherit',
    // Windows では claude が .cmd として提供されるため、シェル経由で起動する
    shell: process.platform === 'win32',
  });

  if (result.error?.code === 'ENOENT') {
    throw new Error('claude コマンドが見つかりません。Claude Code をインストールしてください');
  }
  if (result.error) throw result.error;

  return result.status;
}

/**
 * claude コマンドを実行する。失敗した場合は例外を投げる（導入を中断させる）。
 */
export function runClaude(args, cwd) {
  const status = spawnClaude(args, cwd);
  if (status !== 0) {
    throw new Error(`claude ${args.join(' ')} が失敗しました（終了コード ${status}）`);
  }
}

/**
 * claude コマンドを実行し、失敗しても処理を続ける。
 * 「そもそも導入されていない」状態での解除など、失敗しても支障のない場面で使う。
 */
export function tryRunClaude(args, cwd) {
  return spawnClaude(args, cwd) === 0;
}

/** 導入済みプラグインの識別子（`<プラグイン名>@<マーケットプレイス名>`）を返す */
export function installedPluginIds(cwd) {
  const result = spawnSync('claude', ['plugin', 'list', '--json'], {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) return [];

  try {
    return JSON.parse(result.stdout).map((plugin) => plugin.id);
  } catch {
    // 一覧を読めない場合は「導入済みのものは無い」とみなし、導入するかどうかは利用者に尋ねる
    return [];
  }
}

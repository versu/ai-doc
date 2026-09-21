import fs from 'node:fs';

/**
 * ディレクトリリンクを作成する。既に同じ実体を指していれば何もしない。
 * リンク以外（実ディレクトリ・実ファイル）が存在する場合は、壊さずに 'conflict' を返す。
 *
 * Windows では junction として作られるため、管理者権限も開発者モードも要らない。
 */
export function ensureDirLink(linkPath, target) {
  const stat = fs.lstatSync(linkPath, { throwIfNoEntry: false });

  if (stat === undefined) {
    fs.symlinkSync(target, linkPath, 'junction');
    return 'created';
  }

  if (!stat.isSymbolicLink()) return 'conflict';

  // リンク切れ（クローンの移動・削除）の場合は張り直す
  const current = fs.realpathSync(linkPath, { throwIfNoEntry: false }) ?? null;
  if (current === fs.realpathSync(target)) return 'skipped';

  fs.unlinkSync(linkPath);
  fs.symlinkSync(target, linkPath, 'junction');
  return 'replaced';
}

/** ディレクトリリンクを削除する。リンク以外は削除しない。 */
export function removeDirLink(linkPath) {
  const stat = fs.lstatSync(linkPath, { throwIfNoEntry: false });
  if (stat === undefined || !stat.isSymbolicLink()) return false;

  fs.unlinkSync(linkPath);
  return true;
}

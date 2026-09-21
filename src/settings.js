import fs from 'node:fs';
import path from 'node:path';

export function settingsPathOf(targetDir) {
  return path.join(targetDir, '.claude', 'settings.local.json');
}

/**
 * プロジェクトのローカル設定を読む。
 * ファイルが無い場合は空の設定として扱う。JSON として読めない場合は例外を投げる。
 */
export function readSettings(targetDir) {
  const settingsPath = settingsPathOf(targetDir);
  if (!fs.existsSync(settingsPath)) return {};

  const raw = fs.readFileSync(settingsPath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${settingsPath} を JSON として読み込めません: ${e.message}`);
  }
}

export function writeSettings(targetDir, settings) {
  const settingsPath = settingsPathOf(targetDir);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

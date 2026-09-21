import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// npm link 経由で起動されてもクローン本体を指すよう、実体パスからリポジトリルートを求める
export const AIDOC_ROOT = path.resolve(
  path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))),
  '..',
);

export const MARKETPLACE_NAME = 'ai-doc';
export const PLUGIN_NAME = 'core';
export const PLUGIN_ID = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;

/** 導入先から参照する、スキル横断ガイドの実体 */
export const DOCS_DIR = path.join(AIDOC_ROOT, 'plugins', PLUGIN_NAME, '_docs');

/** ai-doc が配るプラグインのカタログ */
export const MARKETPLACE_FILE = path.join(AIDOC_ROOT, '.claude-plugin', 'marketplace.json');

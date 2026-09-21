#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { install, uninstall, update } from './install.js';

const USAGE = `使い方:
  aidoc install   [対象ディレクトリ]   ai-doc のスキル・ガイドを導入する（既定: カレントディレクトリ）
  aidoc update    [対象ディレクトリ]   外部プラグインを最新化する
  aidoc uninstall [対象ディレクトリ]   導入した設定とリンクを取り除く`;

const COMMANDS = { install, update, uninstall };

const [command, target = '.'] = process.argv.slice(2);

if (!Object.hasOwn(COMMANDS, command ?? '')) {
  console.error(USAGE);
  process.exit(1);
}

const targetDir = path.resolve(target);
if (!fs.statSync(targetDir, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`エラー: 対象ディレクトリが存在しません: ${targetDir}`);
  process.exit(1);
}

try {
  process.exit(await COMMANDS[command](targetDir));
} catch (e) {
  console.error(`エラー: ${e.message}`);
  process.exit(1);
}

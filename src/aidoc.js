#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { install, uninstall, update } from './install.js';
import * as orchestrator from './orchestrator.js';
import { issue, pr } from './skill-settings.js';

const USAGE = `使い方:
  aidoc install   [対象ディレクトリ]   ai-doc のスキル・ガイドを導入する（既定: カレントディレクトリ）
  aidoc update    [対象ディレクトリ]   外部プラグインを最新化する
  aidoc uninstall [対象ディレクトリ]   導入した設定とリンクを取り除く
  aidoc orchestrator init  [対象ディレクトリ]   オーケストレーターの設定ファイルを作る
  aidoc orchestrator check [対象ディレクトリ]   オーケストレーターの設定ファイルを検証する
  aidoc pr init            [対象ディレクトリ]   PR 作成スキルの設定ファイルを作る
  aidoc pr check           [対象ディレクトリ]   PR 作成スキルの設定ファイルを検証する
  aidoc issue init         [対象ディレクトリ]   Issue 作成スキルの設定ファイルを作る
  aidoc issue check        [対象ディレクトリ]   Issue 作成スキルの設定ファイルを検証する`;

const COMMANDS = {
  install,
  update,
  uninstall,
  'orchestrator init': orchestrator.init,
  'orchestrator check': orchestrator.check,
  'pr init': pr.init,
  'pr check': pr.check,
  'issue init': issue.init,
  'issue check': issue.check,
};

// サブコマンドを持つコマンドは、2語目までをコマンド名として扱う
const COMMANDS_WITH_SUBCOMMAND = ['orchestrator', 'pr', 'issue'];
const args = process.argv.slice(2);
const wordCount = COMMANDS_WITH_SUBCOMMAND.includes(args[0]) ? 2 : 1;
const command = args.slice(0, wordCount).join(' ');
const target = args[wordCount] ?? '.';

if (!Object.hasOwn(COMMANDS, command)) {
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

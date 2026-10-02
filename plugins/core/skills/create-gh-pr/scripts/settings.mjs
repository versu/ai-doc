#!/usr/bin/env node
/**
 * 設定ファイル .ai/_settings/create-gh-pr/settings.json の作成・読み取り・検証。
 * 処理の本体はスキル横断の _lib/skill-settings.mjs にある。
 */

import { runDocSettingsCli } from '../../../_lib/skill-settings.mjs';

runDocSettingsCli('create-gh-pr');

import {
  createDocSettings,
  loadDocSettings,
} from '../plugins/core/_lib/skill-settings.mjs';

/**
 * Issue・PR 作成スキルの設定ファイルを作る・検証するコマンドを組み立てる。
 * 判定はスキル側の _lib/skill-settings.mjs に一本化し、ここでは人向けの表示だけを行う。
 * @param skill スキル名（設定フォルダの名前）
 * @param command aidoc のコマンド名（案内に使う）
 */
function docSettingsCommands(skill, command) {
  return {
    init(targetDir) {
      const result = createDocSettings(skill, targetDir);
      if (!result.created) {
        console.log(`- 設定ファイル: 作成済み（上書きしません）: ${result.settingsPath}`);
        return 0;
      }

      console.log(`- 設定ファイル: 作成: ${result.settingsPath}`);
      console.log(
        '\n必要に応じて template（本文のテンプレート）と docs（追加で読ませる規約）を設定し、' +
          `\naidoc ${command} check で設定を検証してください。`,
      );
      return 0;
    },

    check(targetDir) {
      const result = loadDocSettings(skill, targetDir);
      if (!result.ok) {
        console.error(`設定に問題があります: ${result.settingsPath}`);
        for (const error of result.errors) {
          console.error(`- ${error}`);
        }
        return 1;
      }

      // 設定ファイルは任意なので、無いことは問題にしない
      console.log(
        result.exists
          ? `設定に問題はありません: ${result.settingsPath}`
          : `設定ファイルはありません（既定のテンプレートと規約を使います）: ${result.settingsPath}`,
      );
      return 0;
    },
  };
}

export const pr = docSettingsCommands('create-gh-pr', 'pr');
export const issue = docSettingsCommands('create-gh-issue', 'issue');

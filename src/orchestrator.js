import {
  createConfig,
  loadConfig,
} from '../plugins/core/skills/coding-orchestrator/scripts/config.mjs';

/**
 * coding-orchestrator の設定ファイルを作る。
 * 雛形の内容はスキル側の config.mjs に一本化し、ここでは人向けの表示だけを行う。
 */
export function init(targetDir) {
  const result = createConfig(targetDir);
  if (!result.created) {
    console.log(`- .ai/orchestration.json: 作成済み（上書きしません）: ${result.configPath}`);
    return 0;
  }

  console.log(`- .ai/orchestration.json: 作成: ${result.configPath}`);
  console.log(
    '\n次に、implementation.docs と review.docs にプロジェクトの規約ファイルを追加し、' +
      '\naidoc orchestrator check で設定を検証してください。',
  );
  return 0;
}

/** coding-orchestrator の設定ファイルを検証する。判定はスキルの起動時と同じ loadConfig で行う。 */
export function check(targetDir) {
  const result = loadConfig(targetDir);
  if (result.ok) {
    console.log(`設定に問題はありません: ${result.configPath}`);
    return 0;
  }

  if (result.reason === 'not-initialized') {
    console.error(`設定ファイルがありません: ${result.configPath}`);
    console.error('aidoc orchestrator init で作成してください。');
    return 1;
  }

  console.error(`設定に問題があります: ${result.configPath}`);
  for (const error of result.errors ?? [result.message]) {
    console.error(`- ${error}`);
  }
  return 1;
}

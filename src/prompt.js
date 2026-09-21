import readline from 'node:readline/promises';

/**
 * Y/N で確認する。対話的に実行されていない場合は質問せず false を返す。
 */
export async function confirm(question) {
  if (!process.stdin.isTTY) return false;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [y/N]: `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

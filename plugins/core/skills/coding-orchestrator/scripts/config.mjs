#!/usr/bin/env node
/**
 * 設定ファイル .ai/orchestration.json の作成と読み取りを決定論的に行う。
 *
 * 既定値の補完、パスの解決、存在確認はすべて答えが一意に決まる。
 * ここを AI に任せると、現場ごとに解釈が揺れて「読ませたつもりの規約が読まれていない」が起きる。
 *
 * show は常に終了コード0で返す。SKILL.md のインラインシェルから呼ばれるため、
 * 失敗を終了コードではなく JSON の ok / reason で伝える。
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_NODE_MAJOR = 20;
if (Number(process.versions.node.split('.')[0]) < REQUIRED_NODE_MAJOR) {
  console.error(`Node.js ${REQUIRED_NODE_MAJOR} 以上が必要です（現在: ${process.versions.node}）`);
  process.exit(1);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONFIG_PATH = path.join(HERE, '..', 'references', 'orchestration.default.json');
export const CONFIG_RELATIVE_PATH = path.join('.ai', 'orchestration.json');

const ASK_OR_BOOL = ['ask', true, false];

/** 設定の既定値。references/orchestration.default.json と同じ内容を持つ。 */
export function defaults() {
  return JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
}

export function repoRootOf(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return path.resolve(cwd);
  }
}

/**
 * パスを解決する。相対パスの起点は作業ディレクトリではなくリポジトリのルート。
 * サブディレクトリから起動しても同じファイルを指すようにするため。
 */
export function resolveDocPath(docPath, repoRoot) {
  if (docPath.startsWith('~')) return path.join(os.homedir(), docPath.slice(1));
  if (path.isAbsolute(docPath)) return docPath;
  return path.join(repoRoot, docPath);
}

/** 欠けているキーを既定値で補い、値の妥当性を確かめる。戻り値の errors が空なら使える。 */
export function mergeConfig(raw, base = defaults()) {
  const errors = [];
  const merged = {
    orchestrator: { ...base.orchestrator, ...(raw.orchestrator ?? {}) },
    implementation: { ...base.implementation, ...(raw.implementation ?? {}) },
    review: { ...base.review, ...(raw.review ?? {}) },
  };

  for (const key of ['createIssue', 'createPullRequest']) {
    if (!ASK_OR_BOOL.includes(merged.orchestrator[key])) {
      errors.push(`orchestrator.${key}: "ask" / true / false のいずれかを指定してください（現在: ${JSON.stringify(merged.orchestrator[key])}）`);
    }
  }
  for (const section of ['implementation', 'review']) {
    for (const key of ['skills', 'docs']) {
      if (!Array.isArray(merged[section][key])) {
        errors.push(`${section}.${key}: 配列を指定してください（現在: ${JSON.stringify(merged[section][key])}）`);
      }
    }
  }
  if (!Number.isInteger(merged.review.roundCap) || merged.review.roundCap < 1) {
    errors.push(`review.roundCap: 1 以上の整数を指定してください（現在: ${JSON.stringify(merged.review.roundCap)}）`);
  }
  // commit スキルはユーザーの承認を求めるが、実装エージェントは質問できないので噛み合わない
  if ((merged.implementation.skills ?? []).some((s) => s === 'commit' || s === 'core:commit')) {
    errors.push('implementation.skills: commit スキルは指定できません。ユーザーの承認を求める設計のため、質問できない実装エージェントとは契約が矛盾します。コミット規約は implementation.docs 経由で読ませてください');
  }

  return { config: merged, errors };
}

/** 設定を読み、既定値で補い、docs のパスを解決して存在を確認したものを返す。 */
export function loadConfig(cwd) {
  const repoRoot = repoRootOf(cwd);
  const configPath = path.join(repoRoot, CONFIG_RELATIVE_PATH);
  if (!fs.existsSync(configPath)) {
    return {
      ok: false,
      reason: 'not-initialized',
      configPath,
      // 作成コマンドをそのまま貼れる形で返す。スキル側で組み立て直させない
      initCommand: `node ${path.join(HERE, 'config.mjs')} init`,
      message: `設定ファイルがありません: ${configPath}\n次を実行して作成し、docs を現場の規約ファイルに直してから、もう一度呼んでください。\n  node ${path.join(HERE, 'config.mjs')} init`,
    };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    return { ok: false, reason: 'invalid-json', configPath, message: `JSON として読めません: ${e.message}` };
  }

  const { config, errors } = mergeConfig(raw);
  if (errors.length > 0) {
    return { ok: false, reason: 'invalid-value', configPath, message: errors.join('\n'), errors };
  }

  const resolveDocs = (docs) =>
    docs.map((d) => {
      const resolved = resolveDocPath(d, repoRoot);
      return { path: d, resolved, exists: fs.existsSync(resolved) };
    });

  const implementationDocs = resolveDocs(config.implementation.docs);
  const reviewDocs = resolveDocs(config.review.docs);
  // 現場によって規約ファイルの有無は変わる。ここで止めると使い物にならないので、警告にとどめる
  const missingDocs = [...implementationDocs, ...reviewDocs].filter((d) => !d.exists).map((d) => d.path);

  return {
    ok: true,
    configPath,
    repoRoot,
    orchestrator: config.orchestrator,
    implementation: { skills: config.implementation.skills, docs: implementationDocs },
    review: { skills: config.review.skills, docs: reviewDocs, roundCap: config.review.roundCap },
    missingDocs: [...new Set(missingDocs)],
  };
}

// --- サブコマンド ---------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith('--') ? (i += 1, next) : true;
  }
  return args;
}

const COMMANDS = {
  /** 雛形をコピーする。既にあれば上書きせず、現在の内容を見せる。 */
  init(args) {
    const repoRoot = repoRootOf(args.repo ?? process.cwd());
    const configPath = path.join(repoRoot, CONFIG_RELATIVE_PATH);
    if (fs.existsSync(configPath)) {
      console.log(JSON.stringify({ created: false, reason: 'already-exists', configPath, content: JSON.parse(fs.readFileSync(configPath, 'utf8')) }, null, 2));
      return;
    }
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.copyFileSync(DEFAULT_CONFIG_PATH, configPath);
    console.log(JSON.stringify({ created: true, configPath, content: defaults() }, null, 2));
  },

  /** 解決済みの設定を返す。インラインシェルから呼ばれるため常に終了コード0。 */
  show(args) {
    console.log(JSON.stringify(loadConfig(args.repo ?? process.cwd()), null, 2));
  },
};

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || !COMMANDS[command]) {
    console.error(`使い方: config.mjs <${Object.keys(COMMANDS).join(' | ')}> [--repo <path>]`);
    process.exit(1);
  }
  COMMANDS[command](parseArgs(rest));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

#!/usr/bin/env node
/**
 * 設定ファイル .ai/orchestration.json の作成と読み取りを決定論的に行う。
 *
 * 既定値の補完、パスの解決、存在確認はすべて答えが一意に決まる。
 * ここを AI に任せると、現場ごとに解釈が揺れて「読ませたつもりの規約が読まれていない」が起きる。
 *
 * show は常に終了コード0で返す。SKILL.md のインラインシェルから呼ばれるため、
 * 失敗を終了コードではなく JSON の ok / reason で伝える。
 * check は同じ判定を行い、問題があれば終了コード1で返す。スキルの開始時に Bash から呼ばれる。
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

/**
 * init が書き出す雛形。implementation.docs / review.docs は既定に追加される項目なので空にしておく。
 * 既定の規約を並べると、現場で足した規約との区別がつかなくなるため。
 */
export function initialConfig() {
  const content = defaults();
  content.implementation.docs = [];
  content.review.docs = [];
  return content;
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

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * 欠けているキーを既定値で補い、値の妥当性を確かめる。戻り値の errors が空なら使える。
 * 問題は最初の1件で止めずにすべて集める。直しては再実行、を繰り返させないため。
 */
export function mergeConfig(raw, base = defaults()) {
  if (!isPlainObject(raw)) {
    return { config: null, errors: [`設定ファイルの最上位は JSON オブジェクト（{ ... }）にしてください（現在: ${JSON.stringify(raw)}）`] };
  }

  const errors = [];
  const sections = Object.keys(base);
  // 既知のキーは既定値の雛形から作る。項目を足したときに一覧の更新漏れが起きないようにするため
  for (const key of Object.keys(raw)) {
    if (!sections.includes(key)) {
      errors.push(`${key}: 未知のキーです。使えるのは ${sections.join(' / ')} です（綴りを確認してください）`);
    }
  }
  const merged = {};
  for (const section of sections) {
    const value = raw[section] ?? {};
    if (!isPlainObject(value)) {
      errors.push(`${section}: オブジェクト（{ ... }）を指定してください（現在: ${JSON.stringify(value)}）`);
      merged[section] = { ...base[section] };
      continue;
    }
    for (const key of Object.keys(value)) {
      if (!(key in base[section])) {
        errors.push(`${section}.${key}: 未知のキーです。使えるのは ${Object.keys(base[section]).join(' / ')} です（綴りを確認してください）`);
      }
    }
    merged[section] = { ...base[section], ...value };
  }

  for (const key of ['createIssue', 'createPullRequest']) {
    if (!ASK_OR_BOOL.includes(merged.orchestrator[key])) {
      errors.push(`orchestrator.${key}: "ask" / true / false のいずれかを指定してください（現在: ${JSON.stringify(merged.orchestrator[key])}）`);
    }
  }
  const checkStringArray = (name, value) => {
    if (!Array.isArray(value)) {
      errors.push(`${name}: 配列を指定してください（現在: ${JSON.stringify(value)}）`);
      return false;
    }
    const invalid = value.filter((v) => typeof v !== 'string' || v.trim() === '');
    if (invalid.length > 0) {
      errors.push(`${name}: 要素は空でない文字列にしてください（不正な要素: ${invalid.map((v) => JSON.stringify(v)).join(', ')}）`);
      return false;
    }
    return true;
  };
  for (const section of ['implementation', 'review']) {
    checkStringArray(`${section}.skills`, merged[section].skills);
    // docs だけは上書きせず既定に追加する。共通の規約を読ませたまま、現場の規約を足せるようにするため
    if (checkStringArray(`${section}.docs`, merged[section].docs)) {
      merged[section].docs = [...new Set([...base[section].docs, ...merged[section].docs])];
    }
  }
  const { template } = merged.pullRequest;
  if (template !== null && (typeof template !== 'string' || template.trim() === '')) {
    errors.push(`pullRequest.template: ファイルのパスか null を指定してください（現在: ${JSON.stringify(template)}）`);
  }
  checkStringArray('pullRequest.docs', merged.pullRequest.docs);
  if (!Number.isInteger(merged.review.roundCap) || merged.review.roundCap < 1) {
    errors.push(`review.roundCap: 1 以上の整数を指定してください（現在: ${JSON.stringify(merged.review.roundCap)}）`);
  }
  // commit スキルはユーザーの承認を求めるが、実装エージェントは質問できないので噛み合わない
  if (Array.isArray(merged.implementation.skills) && merged.implementation.skills.some((s) => s === 'commit' || s === 'core:commit')) {
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
      message: `設定ファイルがありません: ${configPath}\n次を実行して作成し、docs に現場の規約ファイルを追加してから、もう一度呼んでください。\n  node ${path.join(HERE, 'config.mjs')} init\n（aidoc を npm link 済みなら aidoc orchestrator init でも作れます）`,
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

  const resolveDoc = (d) => {
    const resolved = resolveDocPath(d, repoRoot);
    return { path: d, resolved, exists: fs.existsSync(resolved) };
  };
  const resolveDocs = (docs) => docs.map(resolveDoc);

  const implementationDocs = resolveDocs(config.implementation.docs);
  const reviewDocs = resolveDocs(config.review.docs);
  const pullRequestDocs = resolveDocs(config.pullRequest.docs);
  // 未設定（null）なら PR 作成スキルの既定テンプレートを使う
  const pullRequestTemplate = config.pullRequest.template === null ? null : resolveDoc(config.pullRequest.template);

  // 読ませるはずの規約が無いまま進むと、規約を守らない実装とレビューが通ってしまう。ここで止める
  const base = defaults();
  const isDefaultDoc = (p) => base.implementation.docs.includes(p) || base.review.docs.includes(p);
  // 同じファイルを複数の項目が指していることがあるので、ファイルごとに1行にまとめる
  const missingByPath = new Map();
  const collectMissing = (name, docs) => {
    for (const d of docs.filter((doc) => !doc.exists)) {
      const entry = missingByPath.get(d.path) ?? { doc: d, names: [] };
      entry.names.push(name);
      missingByPath.set(d.path, entry);
    }
  };
  collectMissing('implementation.docs', implementationDocs);
  collectMissing('review.docs', reviewDocs);
  collectMissing('pullRequest.docs', pullRequestDocs);
  if (pullRequestTemplate) collectMissing('pullRequest.template', [pullRequestTemplate]);
  const missingErrors = [...missingByPath.values()].map(({ doc, names }) => {
    const hint = isDefaultDoc(doc.path) ? '。既定の規約なので、このプロジェクトで aidoc install を実行したか確認してください' : '';
    return `${names.join(' / ')}: ファイルがありません: ${doc.path}（解決先: ${doc.resolved}）${hint}`;
  });
  if (missingErrors.length > 0) {
    return {
      ok: false,
      reason: 'missing-docs',
      configPath,
      message: missingErrors.join('\n'),
      errors: missingErrors,
      missingDocs: [...missingByPath.keys()],
    };
  }

  return {
    ok: true,
    configPath,
    repoRoot,
    orchestrator: config.orchestrator,
    implementation: { skills: config.implementation.skills, docs: implementationDocs },
    review: { skills: config.review.skills, docs: reviewDocs, roundCap: config.review.roundCap },
    pullRequest: { template: pullRequestTemplate, docs: pullRequestDocs },
  };
}

/** 雛形を書き出す。既にあれば上書きせず、現在の内容を返す。 */
export function createConfig(cwd) {
  const configPath = path.join(repoRootOf(cwd), CONFIG_RELATIVE_PATH);
  if (fs.existsSync(configPath)) {
    return { created: false, reason: 'already-exists', configPath, content: JSON.parse(fs.readFileSync(configPath, 'utf8')) };
  }
  const content = initialConfig();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(content, null, 2)}\n`);
  return { created: true, configPath, content };
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
  /** 雛形を書き出す。既にあれば上書きせず、現在の内容を見せる。 */
  init(args) {
    console.log(JSON.stringify(createConfig(args.repo ?? process.cwd()), null, 2));
  },

  /** 解決済みの設定を返す。インラインシェルから呼ばれるため常に終了コード0。 */
  show(args) {
    console.log(JSON.stringify(loadConfig(args.repo ?? process.cwd()), null, 2));
  },

  /**
   * 設定を検証し、問題をすべて列挙する。問題があれば終了コード1。
   * 判定は show と同じ loadConfig なので、両者の ok は食い違わない。
   */
  check(args) {
    const result = loadConfig(args.repo ?? process.cwd());
    const report = { ok: result.ok, configPath: result.configPath };
    if (!result.ok) {
      report.reason = result.reason;
      report.errors = result.errors ?? [result.message];
      if (result.initCommand) report.initCommand = result.initCommand;
    }
    console.log(JSON.stringify(report, null, 2));
    if (!result.ok) process.exitCode = 1;
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

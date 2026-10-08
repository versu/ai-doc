/**
 * スキルごとの設定ファイル .ai/_settings/<スキル名>/settings.json を扱う、スキル横断の処理。
 *
 * パスの解決と存在確認は答えが一意に決まるので、スキル（AI）に任せずここで行う。
 * 現場ごとに解釈が揺れると「読ませたつもりの規約が読まれていない」が起きるため。
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REQUIRED_NODE_MAJOR = 20;
if (Number(process.versions.node.split('.')[0]) < REQUIRED_NODE_MAJOR) {
  console.error(`Node.js ${REQUIRED_NODE_MAJOR} 以上が必要です（現在: ${process.versions.node}）`);
  process.exit(1);
}

export function repoRootOf(cwd) {
  try {
    // git 管理外（ハブなど）では失敗するのが正常なので、git のエラー出力は出さない
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
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

/** 設定ファイルの置き場所。スキルに関係するファイルを1か所にまとめられるよう、スキルごとにフォルダを分ける。 */
export function settingsPathOf(repoRoot, skill) {
  return path.join(repoRoot, '.ai', '_settings', skill, 'settings.json');
}

export const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 文字列の配列かを確かめ、問題があれば errors に積む。妥当なら true。 */
export function checkStringArray(name, value, errors) {
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
}

/** パスを解決し、存在の有無を添える。 */
export function resolveDoc(docPath, repoRoot) {
  const resolved = resolveDocPath(docPath, repoRoot);
  return { path: docPath, resolved, exists: fs.existsSync(resolved) };
}

/**
 * 存在しないファイルを、ファイルごとに1行のエラーにまとめる。
 * 同じファイルを複数の項目が指していることがあるため。
 * @param entries [項目名, 解決済みの docs の配列] の配列
 * @param hintOf ファイルのパスを受け取り、エラーに添える補足を返す
 */
export function missingDocErrors(entries, hintOf = () => '') {
  const missingByPath = new Map();
  for (const [name, docs] of entries) {
    for (const d of docs.filter((doc) => !doc.exists)) {
      const entry = missingByPath.get(d.path) ?? { doc: d, names: [] };
      entry.names.push(name);
      missingByPath.set(d.path, entry);
    }
  }
  return [...missingByPath.values()].map(
    ({ doc, names }) => `${names.join(' / ')}: ファイルがありません: ${doc.path}（解決先: ${doc.resolved}）${hintOf(doc.path)}`,
  );
}

// --- テンプレートと追加の規約を持つ設定（Issue・PR の作成スキル） ---------------

const DOC_SETTINGS_DEFAULTS = { template: null, docs: [] };

/** 値の妥当性を確かめる。問題は最初の1件で止めず、すべて集める。直しては再実行、を繰り返させないため。 */
export function validateDocSettings(raw) {
  if (!isPlainObject(raw)) {
    return [`設定ファイルの最上位は JSON オブジェクト（{ ... }）にしてください（現在: ${JSON.stringify(raw)}）`];
  }
  const errors = [];
  const keys = Object.keys(DOC_SETTINGS_DEFAULTS);
  for (const key of Object.keys(raw)) {
    if (!keys.includes(key)) {
      errors.push(`${key}: 未知のキーです。使えるのは ${keys.join(' / ')} です（綴りを確認してください）`);
    }
  }
  const { template = null, docs = [] } = raw;
  if (template !== null && (typeof template !== 'string' || template.trim() === '')) {
    errors.push(`template: ファイルのパスか null を指定してください（現在: ${JSON.stringify(template)}）`);
  }
  checkStringArray('docs', docs, errors);
  return errors;
}

/**
 * Issue・PR の作成スキルの設定を読み、パスを解決して存在を確認したものを返す。
 * 設定ファイルは任意。無ければ既定（スキル同梱のテンプレートと規約だけを使う）として扱う。
 */
export function loadDocSettings(skill, cwd) {
  const repoRoot = repoRootOf(cwd);
  const settingsPath = settingsPathOf(repoRoot, skill);
  if (!fs.existsSync(settingsPath)) {
    return { ok: true, settingsPath, exists: false, template: null, docs: [] };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    return { ok: false, reason: 'invalid-json', settingsPath, errors: [`JSON として読めません: ${e.message}`] };
  }

  const errors = validateDocSettings(raw);
  if (errors.length > 0) {
    return { ok: false, reason: 'invalid-value', settingsPath, errors };
  }

  const settings = { ...DOC_SETTINGS_DEFAULTS, ...raw };
  const template = settings.template === null ? null : resolveDoc(settings.template, repoRoot);
  const docs = settings.docs.map((d) => resolveDoc(d, repoRoot));
  const missing = missingDocErrors([['docs', docs], ...(template ? [['template', [template]]] : [])]);
  if (missing.length > 0) {
    return { ok: false, reason: 'missing-docs', settingsPath, errors: missing };
  }

  return { ok: true, settingsPath, exists: true, template, docs };
}

/** 雛形を書き出す。既にあれば上書きせず、現在の内容を返す。 */
export function createDocSettings(skill, cwd) {
  const settingsPath = settingsPathOf(repoRootOf(cwd), skill);
  if (fs.existsSync(settingsPath)) {
    return { created: false, reason: 'already-exists', settingsPath, content: JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
  }
  const content = { ...DOC_SETTINGS_DEFAULTS };
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(content, null, 2)}\n`);
  return { created: true, settingsPath, content };
}

// --- サブコマンド ---------------------------------------------------------

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith('--') ? (i += 1, next) : true;
  }
  return args;
}

/**
 * Issue・PR の作成スキルの scripts/settings.mjs から呼ぶ CLI。
 * show は SKILL.md のインラインシェルから呼ばれるため常に終了コード0で、失敗は JSON の ok / errors で伝える。
 * check は同じ判定を行い、問題があれば終了コード1で返す。
 */
export function runDocSettingsCli(skill, argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  const cwd = parseArgs(rest).repo ?? process.cwd();
  const print = (value) => console.log(JSON.stringify(value, null, 2));

  switch (command) {
    case 'init':
      print(createDocSettings(skill, cwd));
      return;
    case 'show':
      print(loadDocSettings(skill, cwd));
      return;
    case 'check': {
      const result = loadDocSettings(skill, cwd);
      print(result.ok ? { ok: true, settingsPath: result.settingsPath } : result);
      if (!result.ok) process.exitCode = 1;
      return;
    }
    default:
      console.error('使い方: settings.mjs <init | show | check> [--repo <path>]');
      process.exitCode = 1;
  }
}

#!/usr/bin/env node
/**
 * 設定ファイル .ai/_settings/coding-orchestrator/settings.json の作成と読み取りを決定論的に行う。
 *
 * 既定値の補完、パスの解決、存在確認はすべて答えが一意に決まる。
 * ここを AI に任せると、現場ごとに解釈が揺れて「読ませたつもりの規約が読まれていない」が起きる。
 *
 * show は常に終了コード0で返す。SKILL.md のインラインシェルから呼ばれるため、
 * 失敗を終了コードではなく JSON の ok / reason で伝える。
 * check は同じ判定を行い、問題があれば終了コード1で返す。スキルの開始時に Bash から呼ばれる。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkStringArray,
  isPlainObject,
  loadDocSettings,
  missingDocErrors,
  parseArgs,
  repoRootOf,
  resolveDoc,
  resolveDocPath,
  settingsPathOf,
} from '../../../_lib/skill-settings.mjs';

export { repoRootOf, resolveDocPath };

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONFIG_PATH = path.join(HERE, '..', 'references', 'orchestration.default.json');
export const SKILL_NAME = 'coding-orchestrator';
export const CONFIG_RELATIVE_PATH = settingsPathOf('', SKILL_NAME);

/**
 * オーケストレーターから呼ぶスキルのうち、自分の設定を持つもの。
 * 実装を終えたあとの Issue・PR 作成で初めて止まらないよう、開始時の check でまとめて検証する。
 */
export const CALLEE_SKILLS = ['create-gh-issue', 'create-gh-pr'];

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

/**
 * 欠けているキーを既定値で補い、値の妥当性を確かめる。戻り値の errors が空なら使える。
 * 問題は最初の1件で止めず、すべて集める。直しては再実行、を繰り返させないため。
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
  for (const section of ['implementation', 'review']) {
    checkStringArray(`${section}.skills`, merged[section].skills, errors);
    // docs だけは上書きせず既定に追加する。共通の規約を読ませたまま、現場の規約を足せるようにするため
    if (checkStringArray(`${section}.docs`, merged[section].docs, errors)) {
      merged[section].docs = [...new Set([...base[section].docs, ...merged[section].docs])];
    }
  }
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
  const configPath = settingsPathOf(repoRoot, SKILL_NAME);
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

  const implementationDocs = config.implementation.docs.map((d) => resolveDoc(d, repoRoot));
  const reviewDocs = config.review.docs.map((d) => resolveDoc(d, repoRoot));

  // 読ませるはずの規約が無いまま進むと、規約を守らない実装とレビューが通ってしまう。ここで止める
  const base = defaults();
  const isDefaultDoc = (p) => base.implementation.docs.includes(p) || base.review.docs.includes(p);
  const missingErrors = missingDocErrors(
    [['implementation.docs', implementationDocs], ['review.docs', reviewDocs]],
    (p) => (isDefaultDoc(p) ? '。既定の規約なので、このプロジェクトで aidoc install を実行したか確認してください' : ''),
  );
  if (missingErrors.length > 0) {
    return {
      ok: false,
      reason: 'missing-docs',
      configPath,
      message: missingErrors.join('\n'),
      errors: missingErrors,
    };
  }

  return {
    ok: true,
    configPath,
    repoRoot,
    orchestrator: config.orchestrator,
    implementation: { skills: config.implementation.skills, docs: implementationDocs },
    review: { skills: config.review.skills, docs: reviewDocs, roundCap: config.review.roundCap },
  };
}

/**
 * オーケストレーター自身の設定に加え、呼び出し先スキルの設定も検証する。
 * 問題はまとめて返す。オーケストレーター側が通っていて呼び出し先だけが不正なら reason は invalid-skill-settings。
 */
export function checkAll(cwd) {
  const result = loadConfig(cwd);
  const report = { ok: result.ok, configPath: result.configPath, errors: [] };
  if (!result.ok) {
    report.reason = result.reason;
    report.errors.push(...(result.errors ?? [result.message]));
    if (result.initCommand) report.initCommand = result.initCommand;
  }

  for (const skill of CALLEE_SKILLS) {
    const settings = loadDocSettings(skill, cwd);
    if (settings.ok) continue;
    report.ok = false;
    report.reason ??= 'invalid-skill-settings';
    report.errors.push(...settings.errors.map((e) => `${skill}（${settings.settingsPath}）: ${e}`));
  }

  if (report.ok) delete report.errors;
  return report;
}

/** 雛形を書き出す。既にあれば上書きせず、現在の内容を返す。 */
export function createConfig(cwd) {
  const configPath = settingsPathOf(repoRootOf(cwd), SKILL_NAME);
  if (fs.existsSync(configPath)) {
    return { created: false, reason: 'already-exists', configPath, content: JSON.parse(fs.readFileSync(configPath, 'utf8')) };
  }
  const content = initialConfig();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(content, null, 2)}\n`);
  return { created: true, configPath, content };
}

// --- サブコマンド ---------------------------------------------------------

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
   * 判定は show と同じ loadConfig に、呼び出し先スキルの設定の検証を足したもの。
   */
  check(args) {
    const report = checkAll(args.repo ?? process.cwd());
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
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

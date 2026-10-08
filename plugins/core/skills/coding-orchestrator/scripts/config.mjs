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
  createDocSettings,
  isPlainObject,
  loadDocSettings,
  missingDocErrors,
  parseArgs,
  repoRootOf,
  resolveDoc,
  resolveDocPath,
  settingsPathOf,
} from '../../../_lib/skill-settings.mjs';
import { loadWorkspace, unsyncedRepos } from '../../../_lib/workspace.mjs';

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
 * repos は複数リポジトリモードのときだけ、対象リポジトリごとの空の枠を書く（単一リポジトリでは使わないため省く）。
 */
export function initialConfig(repoKeys = []) {
  const content = defaults();
  content.implementation.docs = [];
  content.review.docs = [];
  if (repoKeys.length === 0) {
    delete content.repos;
  } else {
    content.repos = Object.fromEntries(repoKeys.map((key) => [key, { implementation: { docs: [] }, review: { docs: [] } }]));
  }
  return content;
}

const REPO_SECTIONS = ['implementation', 'review'];

/**
 * repos（リポジトリ別の追加規約）を検証する。キーはリポジトリ名なので既定値の雛形からは作れず、ここで個別に見る。
 * キーが .code-workspace のリポジトリ名かどうかは、ワークスペースを読む loadConfig で確かめる。
 */
function mergeRepos(value, errors) {
  const merged = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isPlainObject(entry)) {
      errors.push(`repos.${key}: オブジェクト（{ ... }）を指定してください（現在: ${JSON.stringify(entry)}）`);
      continue;
    }
    merged[key] = {};
    for (const name of Object.keys(entry)) {
      if (!REPO_SECTIONS.includes(name)) {
        errors.push(`repos.${key}.${name}: 未知のキーです。使えるのは ${REPO_SECTIONS.join(' / ')} です（綴りを確認してください）`);
      }
    }
    for (const section of REPO_SECTIONS) {
      const sectionValue = entry[section] ?? {};
      merged[key][section] = { docs: [] };
      if (!isPlainObject(sectionValue)) {
        errors.push(`repos.${key}.${section}: オブジェクト（{ ... }）を指定してください（現在: ${JSON.stringify(sectionValue)}）`);
        continue;
      }
      for (const name of Object.keys(sectionValue)) {
        if (name !== 'docs') errors.push(`repos.${key}.${section}.${name}: 未知のキーです。使えるのは docs です（綴りを確認してください）`);
      }
      const docs = sectionValue.docs ?? [];
      if (checkStringArray(`repos.${key}.${section}.docs`, docs, errors)) merged[key][section].docs = docs;
    }
  }
  return merged;
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
    if (section === 'repos') {
      merged.repos = mergeRepos(value, errors);
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

/** 同じファイルを二重に読ませないよう、解決後のパスで重複を除く（共通の規約とリポジトリ別の規約が同じファイルを指すことがある）。 */
const uniqueByResolved = (docs) => [...new Map(docs.map((d) => [d.resolved, d])).values()];

/**
 * 設定を読み、既定値で補い、docs のパスを解決して存在を確認したものを返す。
 *
 * repoRoot（hubRoot）は .ai/ を置く場所。単一リポジトリモードではそのリポジトリのルート、
 * 複数リポジトリモードではハブ。git 操作をする対象リポジトリは repos に並ぶ。
 */
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

  const workspace = loadWorkspace(repoRoot);
  if (!workspace.ok) {
    return { ok: false, reason: 'invalid-workspace', configPath, message: workspace.errors.join('\n'), errors: workspace.errors };
  }
  // .code-workspace にリポジトリを足したのに sync を忘れていると、ハブから読み書きできずに実装が途中で止まる。ここで止める
  const unsynced = unsyncedRepos(workspace);
  if (unsynced.length > 0) {
    const errors = [`ハブからファイルアクセスを許可していないリポジトリがあります: ${unsynced.join(', ')}。ハブで aidoc workspace sync を実行し、セッションを開き直してください`];
    return { ok: false, reason: 'workspace-not-synced', configPath, message: errors[0], errors };
  }

  const { config, errors } = mergeConfig(raw);
  for (const key of Object.keys(config.repos ?? {})) {
    if (!workspace.repos[key]) {
      const known = Object.keys(workspace.repos);
      errors.push(`repos.${key}: .code-workspace に無いリポジトリです${known.length > 0 ? `。使えるのは ${known.join(' / ')} です` : '（単一リポジトリモードでは repos は使いません）'}`);
    }
  }
  if (errors.length > 0) {
    return { ok: false, reason: 'invalid-value', configPath, message: errors.join('\n'), errors };
  }

  const implementationDocs = config.implementation.docs.map((d) => resolveDoc(d, repoRoot));
  const reviewDocs = config.review.docs.map((d) => resolveDoc(d, repoRoot));

  // 読ませるはずの規約が無いまま進むと、規約を守らない実装とレビューが通ってしまう。ここで止める
  const base = defaults();
  const isDefaultDoc = (p) => base.implementation.docs.includes(p) || base.review.docs.includes(p);
  // リポジトリ別の規約の相対パスは、そのリポジトリのルートを起点にする。共通の規約はハブ（repoRoot）が起点のまま
  const repoDocs = Object.fromEntries(Object.entries(workspace.repos).map(([key, repo]) => {
    const extra = config.repos[key] ?? { implementation: { docs: [] }, review: { docs: [] } };
    return [key, {
      implementation: extra.implementation.docs.map((d) => resolveDoc(d, repo.resolved)),
      review: extra.review.docs.map((d) => resolveDoc(d, repo.resolved)),
    }];
  }));

  const missingErrors = missingDocErrors(
    [
      ['implementation.docs', implementationDocs],
      ['review.docs', reviewDocs],
      ...Object.entries(repoDocs).flatMap(([key, docs]) => [
        [`repos.${key}.implementation.docs`, docs.implementation],
        [`repos.${key}.review.docs`, docs.review],
      ]),
    ],
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
    mode: workspace.mode,
    repoRoot,
    hubRoot: repoRoot,
    orchestrator: config.orchestrator,
    implementation: { skills: config.implementation.skills, docs: implementationDocs },
    review: { skills: config.review.skills, docs: reviewDocs, roundCap: config.review.roundCap },
    // そのリポジトリを担当するエージェントに渡す規約。共通の規約にリポジトリ別の規約を足したもの
    repos: Object.fromEntries(Object.entries(workspace.repos).map(([key, repo]) => [key, {
      path: repo.resolved,
      implementation: { docs: uniqueByResolved([...implementationDocs, ...repoDocs[key].implementation]) },
      review: { docs: uniqueByResolved([...reviewDocs, ...repoDocs[key].review]) },
    }])),
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
  const repoRoot = repoRootOf(cwd);
  const configPath = settingsPathOf(repoRoot, SKILL_NAME);
  if (fs.existsSync(configPath)) {
    return { created: false, reason: 'already-exists', configPath, content: JSON.parse(fs.readFileSync(configPath, 'utf8')) };
  }
  const workspace = loadWorkspace(repoRoot);
  const content = initialConfig(workspace.ok ? Object.keys(workspace.repos) : []);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(content, null, 2)}\n`);
  return { created: true, configPath, content };
}

/** 依頼の下書きなどを置くフォルダ。タスクの一覧には出さない（state.mjs の DRAFTS_DIR と同じ名前） */
export const DRAFTS_RELATIVE_PATH = path.join('.ai', '_tasks', '_drafts');

/** 下書き置き場のフォルダを作る。既にあれば何もしない。 */
export function createDraftsDir(cwd) {
  const dir = path.join(repoRootOf(cwd), DRAFTS_RELATIVE_PATH);
  const created = !fs.existsSync(dir);
  fs.mkdirSync(dir, { recursive: true });
  return { created, dir };
}

/**
 * 呼び出し先スキル（Issue・PR 作成）の設定の雛形を書き出す。既にあるものは上書きしない。
 * オーケストレーターの導入と同時に作っておき、本文のテンプレートや規約をどこに書けばよいかを分かるようにするため。
 */
export function createCalleeSettings(cwd) {
  return CALLEE_SKILLS.map((skill) => ({ skill, ...createDocSettings(skill, cwd) }));
}

// --- サブコマンド ---------------------------------------------------------

const COMMANDS = {
  /** 雛形を書き出す。既にあれば上書きせず、現在の内容を見せる。呼び出し先スキルの設定の雛形も書き出す。 */
  init(args) {
    const cwd = args.repo ?? process.cwd();
    console.log(JSON.stringify({ ...createConfig(cwd), callees: createCalleeSettings(cwd), drafts: createDraftsDir(cwd) }, null, 2));
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

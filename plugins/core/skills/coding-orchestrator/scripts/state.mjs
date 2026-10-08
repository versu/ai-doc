#!/usr/bin/env node
/**
 * progress.json の追記と status の算出を決定論的に行う。
 *
 * このスクリプトは判断をしない。合否の判定・指摘の分類・打ち切りの決断は
 * オーケストレーター（AI）の責務であり、ここでは数えて畳み込むだけにしている。
 * 「コマンドが正常終了した」は「ゲートを通過した」ではない。
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRootOf } from './config.mjs';
import { loadWorkspace } from '../../../_lib/workspace.mjs';

const REQUIRED_NODE_MAJOR = 20;
if (Number(process.versions.node.split('.')[0]) < REQUIRED_NODE_MAJOR) {
  console.error(`Node.js ${REQUIRED_NODE_MAJOR} 以上が必要です（現在: ${process.versions.node}）`);
  process.exit(1);
}

/** タスク分解しなかった場合に、履歴の task = null を対応づけるキー */
export const SINGLE_TASK_KEY = 'main';

const DISPOSITION_PREFIXES = ['fixed:', 'deferred:', 'non-actionable:', 'follow-up:', 'stop:'];
const DEFERRED_PREFIXES = ['deferred:', 'follow-up:', 'stop:'];

// --- 検証 ---------------------------------------------------------------

/** kind ごとに data が満たすべき形。契約を破った追記を、書き込む前に弾くために使う。 */
const SHAPES = {
  agreement: { summary: 'string', parentIssue: 'number?' },
  branch: { base: 'string', baseSha: 'string', branch: 'string' },
  implementation: { agentId: 'string?', resumed: 'boolean', result: 'implementationResult' },
  review: {
    mode: ['full', 'regression'],
    base: 'string',
    head: 'string',
    result: 'reviewResult',
    dispositions: 'dispositions',
    unresolvedBlockers: 'number',
  },
  verification: { command: 'string', result: ['pass', 'fail'] },
  decision: { question: 'string', answer: 'string' },
  'pull-request': { number: 'number', base: 'string' },
  'pr-feedback': { pullRequest: 'number', accepted: 'array', rejected: 'array' },
  push: { pullRequest: 'number', head: 'string' },
  completion: { forced: 'boolean' },
};

function typeError(errors, field, expected, value) {
  errors.push(`${field}: ${expected} を期待しましたが ${JSON.stringify(value)} でした`);
}

function checkField(errors, field, spec, value) {
  if (Array.isArray(spec)) {
    if (!spec.includes(value)) typeError(errors, field, spec.join(' / '), value);
    return;
  }
  const optional = spec.endsWith('?');
  const kind = optional ? spec.slice(0, -1) : spec;
  if (value === null || value === undefined) {
    if (!optional) typeError(errors, field, kind, value);
    return;
  }
  switch (kind) {
    case 'string':
      if (typeof value !== 'string') typeError(errors, field, '文字列', value);
      break;
    case 'number':
      if (typeof value !== 'number') typeError(errors, field, '数値', value);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') typeError(errors, field, '真偽値', value);
      break;
    case 'array':
      if (!Array.isArray(value)) typeError(errors, field, '配列', value);
      break;
    case 'dispositions':
      if (!Array.isArray(value)) {
        typeError(errors, field, '配列', value);
        break;
      }
      for (const line of value) {
        if (typeof line !== 'string' || !DISPOSITION_PREFIXES.some((p) => line.startsWith(p))) {
          errors.push(`${field}: 各行は ${DISPOSITION_PREFIXES.join(' / ')} のいずれかで始める必要があります（${JSON.stringify(line)}）`);
        }
      }
      break;
    case 'implementationResult':
      checkImplementationResult(errors, field, value);
      break;
    case 'reviewResult':
      checkReviewResult(errors, field, value);
      break;
    default:
      throw new Error(`未知の検証種別: ${kind}`);
  }
}

function checkImplementationResult(errors, field, value) {
  if (typeof value !== 'object' || value === null) return typeError(errors, field, 'オブジェクト', value);
  checkField(errors, `${field}.status`, ['completed', 'blocked'], value.status);
  checkField(errors, `${field}.summary`, 'string', value.summary);
  checkField(errors, `${field}.acceptanceCriteria`, 'array', value.acceptanceCriteria);
  checkField(errors, `${field}.verification`, 'array', value.verification);
  checkField(errors, `${field}.openQuestions`, 'array', value.openQuestions);
  for (const [i, ac] of (value.acceptanceCriteria ?? []).entries()) {
    checkField(errors, `${field}.acceptanceCriteria[${i}].text`, 'string', ac?.text);
    checkField(errors, `${field}.acceptanceCriteria[${i}].met`, 'boolean', ac?.met);
    checkField(errors, `${field}.acceptanceCriteria[${i}].evidence`, 'string', ac?.evidence);
  }
  for (const [i, q] of (value.openQuestions ?? []).entries()) {
    checkField(errors, `${field}.openQuestions[${i}].question`, 'string', q?.question);
    checkField(errors, `${field}.openQuestions[${i}].assumption`, 'string', q?.assumption);
  }
}

function checkReviewResult(errors, field, value) {
  if (typeof value !== 'object' || value === null) return typeError(errors, field, 'オブジェクト', value);
  checkField(errors, `${field}.status`, ['reviewed', 'aborted'], value.status);
  checkField(errors, `${field}.findings`, 'array', value.findings);
  for (const [i, f] of (value.findings ?? []).entries()) {
    checkField(errors, `${field}.findings[${i}].classification`, ['blocker', 'follow-up', 'non-actionable'], f?.classification);
    checkField(errors, `${field}.findings[${i}].title`, 'string', f?.title);
    // blocker は「こう動かすと壊れる」を書けることが条件。書けないものは blocker ではない。
    if (f?.classification === 'blocker' && !f?.failureScenario) {
      errors.push(`${field}.findings[${i}].failureScenario: blocker には失敗シナリオが必要です`);
    }
  }
}

/** 追記する履歴1件を検証する。戻り値はエラーメッセージの配列（空なら妥当）。 */
export function validateEntry(entry) {
  const errors = [];
  if (typeof entry !== 'object' || entry === null) return ['履歴はオブジェクトである必要があります'];
  const shape = SHAPES[entry.kind];
  if (!shape) return [`kind: ${Object.keys(SHAPES).join(' / ')} のいずれかを期待しましたが ${JSON.stringify(entry.kind)} でした`];
  if (entry.task !== null && entry.task !== undefined && typeof entry.task !== 'string') {
    errors.push('task: 文字列または null である必要があります');
  }
  const data = entry.data ?? {};
  for (const [field, spec] of Object.entries(shape)) checkField(errors, `data.${field}`, spec, data[field]);
  return errors;
}

// --- status の算出 -------------------------------------------------------

const taskKey = (task) => (task === null || task === undefined ? SINGLE_TASK_KEY : task);

/**
 * 履歴をタスクごとに束ねる。
 * タスクに属さない履歴（合意やユーザーの判断）は task = null で記録されるので、
 * 分解している場合はどのタスクにも入れない。入れてしまうと存在しないタスクが生まれる。
 */
function groupByTask(doc) {
  const groups = new Map();
  for (const id of doc.tasks.map((t) => t.id)) groups.set(id, []);
  if (doc.tasks.length === 0) groups.set(SINGLE_TASK_KEY, []);
  for (const h of doc.histories) {
    const key = doc.tasks.length === 0 ? SINGLE_TASK_KEY : h.task;
    if (key === null || key === undefined) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(h);
  }
  return groups;
}

/**
 * タスクの進み具合を、履歴を新しい順に走査して決める。
 * review / implementation / pr-feedback のいずれかに最初に当たった時点で確定し、
 * それ以外の kind（branch や push など）は状態を変えないので読み飛ばす。
 */
function taskStateOf(entries) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const { kind, data } = entries[i];
    if (kind === 'review') {
      if ((data.dispositions ?? []).some((line) => line.startsWith('stop:'))) return 'stopped';
      return data.unresolvedBlockers === 0 ? 'done' : 'running';
    }
    if (kind === 'implementation') return data.result?.status === 'blocked' ? 'blocked' : 'running';
    if (kind === 'pr-feedback') return 'running';
  }
  return 'pending';
}

const lastOf = (entries, kind) => [...entries].reverse().find((h) => h.kind === kind) ?? null;

function roundOf(entries) {
  const reviews = entries.filter((h) => h.kind === 'review');
  const branch = lastOf(entries, 'branch');
  if (!branch && reviews.length === 0) return null;
  const lastReview = reviews.at(-1) ?? null;
  return {
    // 同一 HEAD の再実行をラウンドに数えないため、head の異なる値の個数で数える
    n: new Set(reviews.map((h) => h.data.head)).size,
    base: lastReview ? lastReview.data.head : (branch?.data.baseSha ?? null),
    head: lastReview ? lastReview.data.head : null,
  };
}

function openQuestionsOf(doc, groups) {
  const answered = new Set(doc.histories.filter((h) => h.kind === 'decision').map((h) => h.data.question));
  const open = [];
  for (const [id, entries] of groups) {
    for (const h of entries) {
      if (h.kind !== 'implementation') continue;
      for (const q of h.data.result?.openQuestions ?? []) {
        if (answered.has(q.question)) continue;
        if (open.some((o) => o.question === q.question)) continue;
        open.push({ question: q.question, task: doc.tasks.length === 0 ? null : id, assumption: q.assumption });
      }
    }
  }
  return open;
}

function deferredOf(doc, groups) {
  const out = [];
  for (const [id, entries] of groups) {
    for (const h of entries) {
      if (h.kind !== 'review') continue;
      for (const line of h.data.dispositions ?? []) {
        const prefix = DEFERRED_PREFIXES.find((p) => line.startsWith(p));
        if (!prefix) continue;
        const summary = line.slice(prefix.length).trim();
        const task = doc.tasks.length === 0 ? null : id;
        if (out.some((d) => d.task === task && d.summary === summary)) continue;
        out.push({ task, summary, reason: prefix === 'stop:' ? 'stop' : 'follow-up' });
      }
    }
  }
  return out;
}

/** histories と tasks から status を作り直す。status が壊れたときの復旧にも使う。 */
export function computeStatus(doc, updatedAt) {
  const groups = groupByTask(doc);
  const taskStates = {};
  for (const [id, entries] of groups) {
    const branch = lastOf(entries, 'branch');
    const pr = lastOf(entries, 'pull-request');
    const implementation = lastOf(entries, 'implementation');
    taskStates[id] = {
      state: taskStateOf(entries),
      branch: branch?.data.branch ?? null,
      pullRequest: pr?.data.number ?? null,
      summary: implementation?.data.result?.summary ?? null,
      // このタスクを実装したエージェント。修正や PR への指摘対応で再開するときに使う
      agentId: implementation?.data.agentId ?? null,
    };
  }

  const finished = Object.values(taskStates).every((t) => t.state === 'done' || t.state === 'stopped');
  const agreed = doc.histories.some((h) => h.kind === 'agreement');
  // 全タスクが終わっても done にはしない。PR のレビュー対応が続くことがあるので、
  // ユーザーが完了を指示した（completion がある）ときだけ done にする
  const completed = doc.histories.some((h) => h.kind === 'completion');
  const phase = completed ? 'done' : !agreed ? 'preparation' : finished ? 'pr-created' : 'execution';

  // 最後に扱ったタスク。タスクに属さない履歴（合意など）は読み飛ばす
  const lastKey = doc.tasks.length === 0
    ? (doc.histories.length > 0 ? SINGLE_TASK_KEY : null)
    : ([...doc.histories].reverse().find((h) => h.task && taskStates[h.task])?.task ?? null);
  const lastState = lastKey ? taskStates[lastKey]?.state : null;
  const currentTask =
    doc.tasks.length === 0 || !lastKey || lastState === 'done' || lastState === 'stopped' ? null : lastKey;

  return {
    phase,
    currentTask,
    updatedAt: updatedAt ?? doc.histories.at(-1)?.at ?? null,
    taskStates,
    round: lastKey ? roundOf(groups.get(lastKey) ?? []) : null,
    openQuestions: openQuestionsOf(doc, groups),
    deferred: deferredOf(doc, groups),
  };
}

// --- ファイル入出力 -------------------------------------------------------

const progressPathOf = (dir) => path.join(dir, 'progress.json');

function readDoc(dir) {
  const file = progressPathOf(dir);
  if (!fs.existsSync(file)) fail(`progress.json がありません: ${file}`, 2);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** 途中で落ちても壊れた JSON を残さないよう、一時ファイルへ書いてから rename する。 */
function writeDoc(dir, doc) {
  const file = progressPathOf(dir);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function nowIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

/** タスクディレクトリの置き場所。`_done/` は完了済み、`_drafts/` は下書き置き場なので一覧に出さない。 */
export const TASKS_RELATIVE_PATH = path.join('.ai', '_tasks');
const DONE_DIR = '_done';
export const DRAFTS_DIR = '_drafts';

/**
 * 進行中のタスクを一覧する。
 *
 * どれを選ぶかはユーザーが決めるが、「どれが何だったか」を思い出せる材料
 * （フェーズと直近のサマリ）が無いと選べないので、status から抜いて添える。
 * 新しく触ったものから並べる。
 *
 * `progress.json` の無いディレクトリは、手で作ったメモ置き場などオーケストレーターと
 * 無関係なものなので候補（tasks）に入れず、名前だけを ignored に返す。
 */
export function listTasks(cwd) {
  const repoRoot = repoRootOf(cwd);
  const tasksDir = path.join(repoRoot, TASKS_RELATIVE_PATH);
  if (!fs.existsSync(tasksDir)) return { tasksDir, tasks: [], ignored: [] };

  const tasks = [];
  const ignored = [];
  for (const e of fs.readdirSync(tasksDir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === DONE_DIR || e.name === DRAFTS_DIR) continue;
    const dir = path.join(tasksDir, e.name);
    const file = progressPathOf(dir);
    if (!fs.existsSync(file)) {
      ignored.push(e.name);
      continue;
    }
    // progress.json があるのに読めないものは隠さない。オーケストレーターが作ったファイルが
    // 壊れている可能性が高く、黙って落とすと「あるはずのタスクが出てこない」になり、原因が追えなくなる
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      tasks.push({ name: e.name, dir, phase: null, note: `progress.json を読めません: ${error.message}` });
      continue;
    }
    const status = doc?.status;
    if (typeof status !== 'object' || status === null || Array.isArray(status)) {
      tasks.push({ name: e.name, dir, phase: null, note: 'progress.json に status がありません' });
      continue;
    }
    const states = status.taskStates ?? {};
    const summaries = Object.values(states).map((t) => t.summary).filter(Boolean);
    tasks.push({
      name: e.name,
      dir,
      phase: status.phase ?? null,
      repo: doc.repo ?? null,
      currentTask: status.currentTask ?? null,
      summary: (status.currentTask ? states[status.currentTask]?.summary : null) ?? summaries.at(-1) ?? null,
      updatedAt: status.updatedAt ?? null,
    });
  }
  tasks.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));

  return { tasksDir, tasks, ignored: ignored.sort() };
}

/**
 * タスクを完了にする。completion を追記して、タスクディレクトリを _done/ へ移す。
 *
 * 追記と移動を1つにまとめているのは、片方だけ行われて「done なのに一覧に残る」
 * 「_done/ にあるのに done でない」といった食い違いを作らないため。
 * 失敗したときは何も変えずに例外を投げる。
 */
export function completeTask(dir, { force = false } = {}) {
  const from = path.resolve(dir);
  const tasksDir = path.dirname(from);
  if (!tasksDir.endsWith(`${path.sep}${TASKS_RELATIVE_PATH}`) || path.basename(from) === DONE_DIR) {
    throw new Error(`.ai/_tasks/ の直下のタスクディレクトリを指定してください: ${from}`);
  }
  const file = progressPathOf(from);
  if (!fs.existsSync(file)) throw new Error(`progress.json がありません（オーケストレーターのタスクではありません）: ${file}`);
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`progress.json を読めません: ${error.message}`);
  }
  const to = path.join(tasksDir, DONE_DIR, path.basename(from));
  if (fs.existsSync(to)) throw new Error(`移動先に同名のフォルダがあります: ${to}`);
  const phase = computeStatus(doc).phase;
  if (phase !== 'pr-created' && !force) {
    throw new Error(`phase が pr-created ではありません（現在: ${phase}）。それでも完了にするなら --force を付けてください`);
  }

  const original = fs.readFileSync(file, 'utf8');
  doc.histories.push({ at: nowIso(), kind: 'completion', task: null, data: { forced: phase !== 'pr-created' } });
  doc.status = computeStatus(doc);
  writeDoc(from, doc);
  try {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
  } catch (error) {
    // 移動できなければ追記も取り消し、呼ぶ前の状態に戻す
    fs.writeFileSync(file, original);
    throw new Error(`_done/ へ移動できませんでした: ${error.message}`);
  }
  return { from, to, phase: doc.status.phase };
}

/**
 * Issue 番号を付けたフォルダ名。名前の組み立てを手順書に任せると、書式が揺れて一覧で探せなくなる。
 * 複数リポジトリモードの下書きは `<リポジトリ> <タイトル>` なので、`<リポジトリ>#<番号> <タイトル>` にする。
 */
export function numberedName(name, issue, repo = null) {
  if (repo === null) return `#${issue} ${name}`;
  if (!name.startsWith(`${repo} `)) throw new Error(`フォルダ名が「${repo} 」で始まっていません: ${name}`);
  return `${repo}#${issue} ${name.slice(repo.length + 1)}`;
}

const isIssueNumber = (n) => Number.isInteger(n) && n > 0;

/**
 * 合意後に起票した Issue の番号を、下書きのタスクフォルダに付ける。
 *
 * 下書きのフォルダは Issue より先に作るので、名前に番号が無い。
 * 起票したら親とサブタスクのフォルダを改名し、tasks[].id（サブタスクのフォルダ名と同じ）と issue も書き換える。
 * 実行フェーズの履歴は task に id を持つので、改名できるのは合意前（preparation）の間だけ。
 * 失敗したときは、改名を巻き戻して何も変えずに例外を投げる。
 */
export function assignIssues(dir, { parent = null, tasks: issuesById = {} } = {}) {
  const from = path.resolve(dir);
  const file = progressPathOf(from);
  if (!fs.existsSync(file)) throw new Error(`progress.json がありません（オーケストレーターのタスクではありません）: ${file}`);
  const original = fs.readFileSync(file, 'utf8');
  const doc = JSON.parse(original);
  const phase = computeStatus(doc).phase;
  if (phase !== 'preparation') {
    throw new Error(`合意前（phase が preparation）のタスクだけ番号を付けられます（現在: ${phase}）。実行フェーズの履歴がタスクの id を参照しているためです`);
  }

  if (parent !== null && !isIssueNumber(parent)) throw new Error(`parent: Issue 番号（1 以上の整数）か null を指定してください（現在: ${JSON.stringify(parent)}）`);
  const renames = [];
  for (const [id, issue] of Object.entries(issuesById)) {
    const task = doc.tasks.find((t) => t.id === id);
    if (!task) throw new Error(`tasks: 未知のタスクです: ${id}`);
    if (!isIssueNumber(issue)) throw new Error(`tasks.${id}: Issue 番号（1 以上の整数）を指定してください（現在: ${JSON.stringify(issue)}）`);
    const newId = numberedName(id, issue, task.repo ?? null);
    renames.push({ id, issue, newId, from: path.join(from, id), to: path.join(from, newId) });
  }
  const parentTo = parent === null ? from : path.join(path.dirname(from), numberedName(path.basename(from), parent, doc.repo ?? null));

  // 動かす前に確かめられることは全部確かめる。途中で止まると巻き戻しが要るため
  for (const r of renames) {
    if (!fs.existsSync(r.from)) throw new Error(`サブタスクのフォルダがありません: ${r.from}`);
    if (fs.existsSync(r.to)) throw new Error(`改名先に同名のフォルダがあります: ${r.to}`);
  }
  if (parentTo !== from && fs.existsSync(parentTo)) throw new Error(`改名先に同名のフォルダがあります: ${parentTo}`);

  const done = [];
  try {
    for (const r of renames) {
      fs.renameSync(r.from, r.to);
      done.push(r);
    }
    const newIds = new Map(renames.map((r) => [r.id, r.newId]));
    for (const t of doc.tasks) {
      if (!newIds.has(t.id)) continue;
      t.issue = issuesById[t.id];
      t.id = newIds.get(t.id);
    }
    for (const h of doc.histories) {
      if (newIds.has(h.task)) h.task = newIds.get(h.task);
    }
    doc.status = computeStatus(doc, nowIso());
    writeDoc(from, doc);
    if (parentTo !== from) fs.renameSync(from, parentTo);
  } catch (error) {
    fs.writeFileSync(file, original);
    for (const r of done.reverse()) fs.renameSync(r.to, r.from);
    throw new Error(`番号を付けられませんでした: ${error.message}`);
  }
  return {
    from,
    to: parentTo,
    tasks: renames.map((r) => ({ from: r.id, to: r.newId })),
  };
}

// --- 対象リポジトリ ---------------------------------------------------------

/**
 * タスクディレクトリ（`<ハブ>/.ai/_tasks/<名前>`）からハブを求める。
 * 作業ディレクトリからは求めない。対象リポジトリへ cd したあとに呼ばれても、同じハブを指すようにするため。
 */
export function hubOfTaskDir(dir) {
  const tasksDir = path.dirname(path.resolve(dir));
  if (!tasksDir.endsWith(`${path.sep}${TASKS_RELATIVE_PATH}`)) {
    throw new Error(`.ai/_tasks/ の直下のタスクディレクトリを指定してください: ${dir}`);
  }
  return path.dirname(path.dirname(tasksDir));
}

/**
 * 記録するリポジトリがワークスペースと合っているかを確かめる。戻り値はエラーメッセージの配列。
 * 複数リポジトリモードでは、親（最上位の repo）とすべてのサブタスクのリポジトリが必須。
 */
export function validateRepos(doc, workspace) {
  const errors = [];
  const keys = Object.keys(workspace.repos);
  if (workspace.mode === 'single') {
    if (doc.repo) errors.push('単一リポジトリモード（.code-workspace に対象リポジトリが無い）では --repo を指定しません');
    if (doc.tasks.some((t) => t.repo)) errors.push('単一リポジトリモードでは tasks[].repo を指定しません');
    return errors;
  }
  const check = (field, key) => {
    if (typeof key !== 'string' || key === '') errors.push(`${field}: リポジトリ名を指定してください（${keys.join(' / ')}）`);
    else if (!workspace.repos[key]) errors.push(`${field}: .code-workspace に無いリポジトリです: ${key}（${keys.join(' / ')}）`);
  };
  check('repo（--repo）', doc.repo);
  for (const t of doc.tasks) check(`tasks[${JSON.stringify(t.id)}].repo`, t.repo);
  return errors;
}

/**
 * タスクを作業するリポジトリを解決する。key は tasks[].id か、分解していなければ main。
 * 単一リポジトリモードでは、ハブ自身がリポジトリ。
 */
export function repoOf(doc, key, workspace) {
  if (workspace.mode === 'single') return { repo: null, repoPath: workspace.hubRoot };
  const task = doc.tasks.find((t) => t.id === key);
  if (doc.tasks.length > 0 && key !== null && key !== SINGLE_TASK_KEY && !task) throw new Error(`未知のタスクです: ${key}`);
  const repo = task?.repo ?? doc.repo ?? null;
  if (!repo) throw new Error('progress.json にリポジトリが記録されていません（init --repo で作り直してください）');
  const entry = workspace.repos[repo];
  if (!entry) throw new Error(`.code-workspace に無いリポジトリです: ${repo}`);
  return { repo, repoPath: entry.resolved };
}

function workspaceOfTaskDir(dir) {
  const workspace = loadWorkspace(hubOfTaskDir(dir));
  if (!workspace.ok) throw new Error(`.code-workspace に問題があります:\n- ${workspace.errors.join('\n- ')}`);
  return workspace;
}

/**
 * 積み上げの base を決める。**同じリポジトリの直前のタスク**のブランチから切る。
 * 別のリポジトリのブランチからは切れないので、同じリポジトリに先行するタスクが無ければ null（＝既定ブランチ）。
 */
export function branchBaseOf(doc, key, workspace) {
  const { repo, repoPath } = repoOf(doc, key, workspace);
  if (doc.tasks.length === 0) return { task: SINGLE_TASK_KEY, repo, repoPath, previousTask: null, base: null };
  const index = doc.tasks.findIndex((t) => t.id === key);
  if (index === -1) throw new Error(`未知のタスクです: ${key}`);
  const sameRepo = (t) => workspace.mode === 'single' || (t.repo ?? doc.repo) === repo;
  const previous = doc.tasks.slice(0, index).reverse().find(sameRepo) ?? null;
  if (!previous) return { task: key, repo, repoPath, previousTask: null, base: null };
  const branch = computeStatus(doc).taskStates[previous.id]?.branch ?? null;
  if (!branch) throw new Error(`同じリポジトリの直前のタスク ${previous.id} にブランチがありません。先にそちらを進めてください`);
  return { task: key, repo, repoPath, previousTask: previous.id, base: branch };
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

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

const COMMANDS = {
  init(args) {
    const dir = requireDir(args);
    const file = progressPathOf(dir);
    if (fs.existsSync(file) && !args.force) fail(`既に存在します（上書きするなら --force）: ${file}`);
    const tasks = args.tasks ? JSON.parse(fs.readFileSync(args.tasks, 'utf8')) : [];
    const doc = { status: null, ...(typeof args.repo === 'string' ? { repo: args.repo } : {}), tasks, histories: [] };
    let workspace;
    try {
      workspace = workspaceOfTaskDir(dir);
    } catch (error) {
      fail(error.message);
    }
    const repoErrors = validateRepos(doc, workspace);
    if (repoErrors.length > 0) fail(`リポジトリの指定が合いません。作りませんでした:\n- ${repoErrors.join('\n- ')}`);
    doc.status = computeStatus(doc, nowIso());
    fs.mkdirSync(dir, { recursive: true });
    writeDoc(dir, doc);
    console.log(JSON.stringify(doc.status, null, 2));
  },

  append(args) {
    const dir = requireDir(args);
    const raw = args.file ? fs.readFileSync(args.file, 'utf8') : readStdin();
    if (!raw.trim()) fail('追記する履歴を標準入力（または --file）で渡してください');
    let entry;
    try {
      entry = JSON.parse(raw);
    } catch (e) {
      fail(`JSON として読めませんでした: ${e.message}`);
    }
    const errors = validateEntry(entry);
    if (errors.length > 0) fail(`契約に合いません。書き込みませんでした:\n- ${errors.join('\n- ')}`);

    const doc = readDoc(dir);
    doc.histories.push({ at: entry.at ?? nowIso(), kind: entry.kind, task: entry.task ?? null, data: entry.data });
    doc.status = computeStatus(doc);
    writeDoc(dir, doc);
    console.log(JSON.stringify(doc.status, null, 2));
  },

  recompute(args) {
    const dir = requireDir(args);
    const doc = readDoc(dir);
    doc.status = computeStatus(doc, nowIso());
    writeDoc(dir, doc);
    console.log(JSON.stringify(doc.status, null, 2));
  },

  show(args) {
    const dir = requireDir(args);
    const doc = readDoc(dir);
    // エージェントやスキルに渡す作業場所を、オーケストレーターに組み立てさせないよう解決して返す
    try {
      const workspace = workspaceOfTaskDir(dir);
      const top = repoOf(doc, doc.tasks.length === 0 ? SINGLE_TASK_KEY : null, workspace);
      const tasks = doc.tasks.map((t) => ({ ...t, repoPath: repoOf(doc, t.id, workspace).repoPath }));
      console.log(JSON.stringify({ status: doc.status, repo: top.repo, repoPath: top.repoPath, tasks }, null, 2));
    } catch (error) {
      fail(error.message);
    }
  },

  /** タスクを完了にして _done/ へ移す。phase が pr-created でなければ --force が要る。 */
  complete(args) {
    const dir = requireDir(args);
    try {
      console.log(JSON.stringify(completeTask(dir, { force: args.force === true }), null, 2));
    } catch (error) {
      fail(error.message);
    }
  },

  /** 積み上げの base と、作業するリポジトリを返す。ブランチを準備する前に呼ぶ。 */
  'branch-base'(args) {
    const dir = requireDir(args);
    const doc = readDoc(dir);
    const key = args.task ?? SINGLE_TASK_KEY;
    try {
      console.log(JSON.stringify(branchBaseOf(doc, key, workspaceOfTaskDir(dir)), null, 2));
    } catch (error) {
      fail(error.message);
    }
  },

  /** 下書きのタスクフォルダに、起票した Issue の番号を付ける。標準入力に { parent, tasks } の JSON を受け取る。 */
  'assign-issues'(args) {
    const dir = requireDir(args);
    const raw = args.file ? fs.readFileSync(args.file, 'utf8') : readStdin();
    let issues;
    try {
      issues = JSON.parse(raw);
    } catch (e) {
      fail(`JSON として読めませんでした: ${e.message}`);
    }
    try {
      console.log(JSON.stringify(assignIssues(dir, issues), null, 2));
    } catch (error) {
      fail(error.message);
    }
  },

  /** 進行中のタスクを一覧する。どれを扱うかを選んでもらうために使う。 */
  list(args) {
    console.log(JSON.stringify(listTasks(args.repo ?? process.cwd()), null, 2));
  },

  /**
   * 次のレビュー範囲の起点を返す。
   * 2周目以降は「直前ラウンドの head」から見せたいが、それが成り立つのは
   * 履歴が素直に伸びている場合だけ。rebase や amend で崩れていたら安全側に倒す。
   */
  'review-base'(args) {
    const dir = requireDir(args);
    const doc = readDoc(dir);
    const key = args.task ?? (doc.tasks.length === 0 ? SINGLE_TASK_KEY : doc.status?.currentTask);
    if (!key) fail('対象のタスクを --task で指定してください');
    // 作業ディレクトリ（ハブ）で git を実行しないよう、既定ではタスクのリポジトリを使う
    let repo = args.repo;
    if (typeof repo !== 'string') {
      try {
        repo = repoOf(doc, key, workspaceOfTaskDir(dir)).repoPath;
      } catch (error) {
        fail(error.message);
      }
    }
    const entries = groupByTask(doc).get(key) ?? [];
    const branch = lastOf(entries, 'branch');
    if (!branch) fail(`タスク ${key} の branch 履歴がありません。先にブランチを準備してください`);
    const baseSha = branch.data.baseSha;
    const head = git(['rev-parse', 'HEAD'], repo);
    const clean = git(['status', '--porcelain'], repo) === '';

    const reviews = entries.filter((h) => h.kind === 'review');
    const previousHead = reviews.at(-1)?.data.head ?? null;

    let base = baseSha;
    let mode = 'full';
    let reason = '初回のレビューなので、タスクの変更全体を見る';
    if (previousHead) {
      const isAncestor = (() => {
        try {
          git(['merge-base', '--is-ancestor', previousHead, head], repo);
          return true;
        } catch {
          return false;
        }
      })();
      const rangeCount = isAncestor ? Number(git(['rev-list', '--count', `${previousHead}..${head}`], repo)) : 0;
      if (isAncestor && rangeCount > 0) {
        base = previousHead;
        mode = 'regression';
        reason = '直前のラウンドからの修正だけを見る';
      } else if (!isAncestor) {
        reason = '直前の head が現 HEAD の祖先でない（rebase や amend の可能性）ため、タスクの起点に戻す';
      } else {
        // 差分が空なのは実装が何も変えなかったということ。「指摘ゼロ＝合格」と読ませない。
        reason = '直前のラウンドから差分がない。実装が行われていない可能性があるため、レビューの前に確認する';
      }
    }
    console.log(JSON.stringify({ task: key, base, head, mode, clean, previousHead, reason }, null, 2));
  },
};

function requireDir(args) {
  if (typeof args.dir !== 'string') fail('--dir でタスクディレクトリを指定してください');
  return path.resolve(args.dir);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || !COMMANDS[command]) {
    console.error(`使い方: state.mjs <${Object.keys(COMMANDS).join(' | ')}> --dir <タスクディレクトリ>`);
    process.exit(1);
  }
  COMMANDS[command](parseArgs(rest));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

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
  const phase = !agreed ? 'preparation' : finished ? 'done' : 'execution';

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

/** タスクディレクトリの置き場所。`_done/` は完了済みなので一覧に出さない。 */
export const TASKS_RELATIVE_PATH = path.join('.ai', '_tasks');
const DONE_DIR = '_done';

/**
 * 進行中のタスクを一覧する。
 *
 * どれを選ぶかはユーザーが決めるが、「どれが何だったか」を思い出せる材料
 * （フェーズと直近のサマリ）が無いと選べないので、status から抜いて添える。
 * 新しく触ったものから並べる。
 */
export function listTasks(cwd) {
  const repoRoot = repoRootOf(cwd);
  const tasksDir = path.join(repoRoot, TASKS_RELATIVE_PATH);
  if (!fs.existsSync(tasksDir)) return { tasksDir, tasks: [] };

  const tasks = fs
    .readdirSync(tasksDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== DONE_DIR)
    .map((e) => {
      const dir = path.join(tasksDir, e.name);
      const file = progressPathOf(dir);
      // progress.json が無い／壊れているディレクトリも隠さない。
      // 黙って落とすと「あるはずのタスクが出てこない」になり、原因が追えなくなる
      if (!fs.existsSync(file)) return { name: e.name, dir, phase: null, note: 'progress.json がありません' };
      let doc;
      try {
        doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        return { name: e.name, dir, phase: null, note: `progress.json を読めません: ${error.message}` };
      }
      const status = doc.status ?? {};
      const states = status.taskStates ?? {};
      const summaries = Object.values(states).map((t) => t.summary).filter(Boolean);
      return {
        name: e.name,
        dir,
        phase: status.phase ?? null,
        currentTask: status.currentTask ?? null,
        summary: (status.currentTask ? states[status.currentTask]?.summary : null) ?? summaries.at(-1) ?? null,
        updatedAt: status.updatedAt ?? null,
      };
    })
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));

  return { tasksDir, tasks };
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
    const doc = { status: null, tasks, histories: [] };
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
    console.log(JSON.stringify({ status: doc.status, tasks: doc.tasks }, null, 2));
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
    const repo = args.repo ?? process.cwd();
    const doc = readDoc(dir);
    const key = args.task ?? (doc.tasks.length === 0 ? SINGLE_TASK_KEY : doc.status?.currentTask);
    if (!key) fail('対象のタスクを --task で指定してください');
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

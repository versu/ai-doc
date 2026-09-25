import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { completeTask, computeStatus, listTasks, validateEntry, TASKS_RELATIVE_PATH } from './state.mjs';

const at = (n) => `2026-09-22T10:0${n}:00+09:00`;

const branch = (task, baseSha, name) => ({
  at: at(0), kind: 'branch', task, data: { base: 'main', baseSha, branch: name },
});

const implementation = (task, { status = 'completed', summary = '実装した', agentId = 'agent-1', openQuestions = [] } = {}) => ({
  at: at(1), kind: 'implementation', task,
  data: { agentId, resumed: false, result: { status, summary, acceptanceCriteria: [], verification: [], openQuestions } },
});

const review = (task, { head = 'h1', unresolvedBlockers = 0, dispositions = [], mode = 'full' } = {}) => ({
  at: at(2), kind: 'review', task,
  data: { mode, base: 'b0', head, result: { status: 'reviewed', readDocs: [], readDocsReason: '', findings: [] }, dispositions, unresolvedBlockers },
});

const docOf = (tasks, histories) => ({ status: null, tasks, histories });

test('履歴が無ければ pending、合意前は preparation', () => {
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], []));
  assert.equal(status.phase, 'preparation');
  assert.equal(status.taskStates['01-a'].state, 'pending');
});

test('未解決ブロッカーが 0 のレビューでタスクは done になり、全体は pr-created になる', () => {
  const histories = [
    { at: at(0), kind: 'agreement', task: null, data: { summary: '合意', parentIssue: null } },
    branch('01-a', 'base1', 'feat/01-a'),
    implementation('01-a'),
    review('01-a', { unresolvedBlockers: 0 }),
  ];
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], histories));
  assert.equal(status.taskStates['01-a'].state, 'done');
  assert.equal(status.phase, 'pr-created');
  assert.equal(status.currentTask, null);
});

test('ブロッカーが残っていれば running のまま', () => {
  const histories = [
    { at: at(0), kind: 'agreement', task: null, data: { summary: '合意', parentIssue: null } },
    branch('01-a', 'base1', 'feat/01-a'),
    implementation('01-a'),
    review('01-a', { unresolvedBlockers: 2 }),
  ];
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], histories));
  assert.equal(status.taskStates['01-a'].state, 'running');
  assert.equal(status.phase, 'execution');
  assert.equal(status.currentTask, '01-a');
});

test('ラウンド数は head の異なる値の個数で数える（同一 HEAD の再実行は数えない）', () => {
  const histories = [
    branch('01-a', 'base1', 'feat/01-a'),
    review('01-a', { head: 'h1', unresolvedBlockers: 1 }),
    review('01-a', { head: 'h1', unresolvedBlockers: 1 }),
    review('01-a', { head: 'h2', unresolvedBlockers: 0, mode: 'regression' }),
  ];
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], histories));
  assert.equal(status.round.n, 2);
});

test('次のレビューの起点は直前のラウンドの head になる', () => {
  const histories = [
    branch('01-a', 'base1', 'feat/01-a'),
    implementation('01-a'),
    review('01-a', { head: 'h1', unresolvedBlockers: 1 }),
  ];
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], histories));
  assert.equal(status.round.base, 'h1');
  assert.equal(status.round.head, 'h1');
  assert.equal(status.taskStates['01-a'].agentId, 'agent-1');
});

test('レビュー前の起点はブランチ準備で得た baseSha', () => {
  const histories = [branch('01-a', 'base1', 'feat/01-a'), implementation('01-a')];
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], histories));
  assert.equal(status.round.base, 'base1');
  assert.equal(status.round.head, null);
});

test('stop: の処置があれば stopped になる', () => {
  const histories = [
    branch('01-a', 'base1', 'feat/01-a'),
    review('01-a', { unresolvedBlockers: 1, dispositions: ['stop: キャッシュ戦略は収束せず'] }),
  ];
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], histories));
  assert.equal(status.taskStates['01-a'].state, 'stopped');
  assert.deepEqual(status.deferred, [{ task: '01-a', summary: 'キャッシュ戦略は収束せず', reason: 'stop' }]);
});

test('実装が blocked を返したら blocked', () => {
  const histories = [branch('01-a', 'base1', 'feat/01-a'), implementation('01-a', { status: 'blocked' })];
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], histories));
  assert.equal(status.taskStates['01-a'].state, 'blocked');
});

test('pr-feedback が来たら done から running に戻る', () => {
  const histories = [
    { at: at(0), kind: 'agreement', task: null, data: { summary: '合意', parentIssue: null } },
    branch('01-a', 'base1', 'feat/01-a'),
    implementation('01-a'),
    review('01-a', { unresolvedBlockers: 0 }),
    { at: at(3), kind: 'pull-request', task: '01-a', data: { number: 12, base: 'main' } },
    { at: at(4), kind: 'pr-feedback', task: '01-a', data: { pullRequest: 12, accepted: ['命名を直す'], rejected: [] } },
  ];
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], histories));
  assert.equal(status.taskStates['01-a'].state, 'running');
  assert.equal(status.taskStates['01-a'].pullRequest, 12);
  assert.equal(status.phase, 'execution');
});

test('push は状態を変えない（直前のレビューの判定が残る）', () => {
  const histories = [
    branch('01-a', 'base1', 'feat/01-a'),
    implementation('01-a'),
    review('01-a', { unresolvedBlockers: 0 }),
    { at: at(3), kind: 'push', task: '01-a', data: { pullRequest: 12, head: 'h9' } },
  ];
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], histories));
  assert.equal(status.taskStates['01-a'].state, 'done');
});

test('回答済みの質問は未解決から消える', () => {
  const histories = [
    branch('01-a', 'base1', 'feat/01-a'),
    implementation('01-a', {
      openQuestions: [
        { question: '重複判定のキーは', why: '', assumption: 'メールで判定', impact: '' },
        { question: '通知は必要か', why: '', assumption: '送らない', impact: '' },
      ],
    }),
    { at: at(3), kind: 'decision', task: '01-a', data: { question: '重複判定のキーは', answer: 'メールでよい' } },
  ];
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], histories));
  assert.deepEqual(status.openQuestions, [{ question: '通知は必要か', task: '01-a', assumption: '送らない' }]);
});

test('タスク分解しない場合は main キーに集約され、task は null で記録される', () => {
  const histories = [branch(null, 'base1', 'feat/x'), implementation(null), review(null, { unresolvedBlockers: 0 })];
  const status = computeStatus(docOf([], histories));
  assert.equal(status.taskStates.main.state, 'done');
  assert.equal(status.currentTask, null);
});

test('先送りは重複を除いて集める', () => {
  const histories = [
    branch('01-a', 'base1', 'feat/01-a'),
    review('01-a', { head: 'h1', unresolvedBlockers: 1, dispositions: ['follow-up: 多言語化'] }),
    review('01-a', { head: 'h2', unresolvedBlockers: 0, dispositions: ['follow-up: 多言語化', 'deferred: 計測の追加'] }),
  ];
  const status = computeStatus(docOf([{ id: '01-a', title: 'A', issue: null }], histories));
  assert.deepEqual(status.deferred, [
    { task: '01-a', summary: '多言語化', reason: 'follow-up' },
    { task: '01-a', summary: '計測の追加', reason: 'follow-up' },
  ]);
});

test('未知の kind は弾く', () => {
  assert.equal(validateEntry({ kind: 'unknown', task: null, data: {} }).length, 1);
});

test('処置の語彙が違えば弾く', () => {
  const errors = validateEntry({
    kind: 'review', task: '01-a',
    data: { mode: 'full', base: 'b', head: 'h', result: { status: 'reviewed', findings: [] }, dispositions: ['直した'], unresolvedBlockers: 0 },
  });
  assert.ok(errors.some((e) => e.includes('dispositions')));
});

test('失敗シナリオの無い blocker は弾く', () => {
  const errors = validateEntry({
    kind: 'review', task: '01-a',
    data: {
      mode: 'full', base: 'b', head: 'h', unresolvedBlockers: 1, dispositions: [],
      result: { status: 'reviewed', findings: [{ classification: 'blocker', title: 'なんとなく不安' }] },
    },
  });
  assert.ok(errors.some((e) => e.includes('failureScenario')));
});

test('契約どおりの実装結果は通る', () => {
  assert.deepEqual(validateEntry(implementation('01-a')), []);
});

// --- タスクの一覧 ---------------------------------------------------------

function withTasksDir(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-'));
  const tasksDir = path.join(root, TASKS_RELATIVE_PATH);
  fs.mkdirSync(tasksDir, { recursive: true });
  try {
    return fn(root, tasksDir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const writeTask = (tasksDir, name, status) => {
  const dir = path.join(tasksDir, name);
  fs.mkdirSync(dir, { recursive: true });
  if (status !== null) fs.writeFileSync(path.join(dir, 'progress.json'), JSON.stringify({ status, tasks: [], histories: [] }));
  return dir;
};

test('タスクディレクトリが無ければ空を返す（例外にしない）', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-'));
  try {
    assert.deepEqual(listTasks(root).tasks, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('_done 配下は一覧に出さない', () => {
  withTasksDir((root, tasksDir) => {
    writeTask(tasksDir, '#42 進行中', { phase: 'execution', currentTask: null, updatedAt: at(1), taskStates: {} });
    writeTask(tasksDir, '_done', { phase: 'done', currentTask: null, updatedAt: at(0), taskStates: {} });
    const { tasks } = listTasks(root);
    assert.deepEqual(tasks.map((t) => t.name), ['#42 進行中']);
  });
});

test('新しく触ったものから並ぶ', () => {
  withTasksDir((root, tasksDir) => {
    writeTask(tasksDir, '#1 古い', { phase: 'execution', currentTask: null, updatedAt: at(0), taskStates: {} });
    writeTask(tasksDir, '#2 新しい', { phase: 'execution', currentTask: null, updatedAt: at(9), taskStates: {} });
    assert.deepEqual(listTasks(root).tasks.map((t) => t.name), ['#2 新しい', '#1 古い']);
  });
});

test('選ぶ材料として phase と直近のサマリを返す', () => {
  withTasksDir((root, tasksDir) => {
    writeTask(tasksDir, '#42 受注サマリ', {
      phase: 'execution',
      currentTask: '#43 キャンセル除外',
      updatedAt: at(1),
      taskStates: { '#43 キャンセル除外': { state: 'running', summary: 'キャンセル済みを除外した' } },
    });
    const [task] = listTasks(root).tasks;
    assert.equal(task.phase, 'execution');
    assert.equal(task.currentTask, '#43 キャンセル除外');
    assert.equal(task.summary, 'キャンセル済みを除外した');
  });
});

test('進行中のタスクが無ければ、最後に埋まったサマリを使う', () => {
  withTasksDir((root, tasksDir) => {
    writeTask(tasksDir, '#42 受注サマリ', {
      phase: 'execution',
      currentTask: null,
      updatedAt: at(1),
      taskStates: { a: { summary: '1つ目' }, b: { summary: '2つ目' }, c: { summary: null } },
    });
    assert.equal(listTasks(root).tasks[0].summary, '2つ目');
  });
});

test('progress.json が無いディレクトリは候補に出さず、ignored に入れる', () => {
  withTasksDir((root, tasksDir) => {
    writeTask(tasksDir, '#42 進行中', { phase: 'execution', currentTask: null, updatedAt: at(1), taskStates: {} });
    writeTask(tasksDir, 'メモ置き場', null);
    const { tasks, ignored } = listTasks(root);
    assert.deepEqual(tasks.map((t) => t.name), ['#42 進行中']);
    assert.deepEqual(ignored, ['メモ置き場']);
  });
});

test('progress.json が壊れているディレクトリは、理由を添えて候補に残す', () => {
  withTasksDir((root, tasksDir) => {
    const broken = path.join(tasksDir, '#51 壊れている');
    fs.mkdirSync(broken, { recursive: true });
    fs.writeFileSync(path.join(broken, 'progress.json'), '{ broken');
    const noStatus = path.join(tasksDir, '#52 status なし');
    fs.mkdirSync(noStatus, { recursive: true });
    fs.writeFileSync(path.join(noStatus, 'progress.json'), JSON.stringify({ histories: [] }));
    const { tasks, ignored } = listTasks(root);
    assert.equal(tasks.length, 2);
    assert.ok(tasks.every((t) => typeof t.note === 'string' && t.note.length > 0));
    assert.deepEqual(ignored, []);
  });
});

test('タスク置き場の直下のファイルは、候補にも ignored にも出さない', () => {
  withTasksDir((root, tasksDir) => {
    fs.writeFileSync(path.join(tasksDir, 'memo.md'), '# メモ');
    const { tasks, ignored } = listTasks(root);
    assert.deepEqual(tasks, []);
    assert.deepEqual(ignored, []);
  });
});

const finishedHistories = () => [
  { at: at(0), kind: 'agreement', task: null, data: { summary: '合意', parentIssue: null } },
  branch(null, 'base1', 'feat/a'),
  implementation(null),
  review(null, { unresolvedBlockers: 0 }),
  { at: at(3), kind: 'pull-request', task: null, data: { number: 12, base: 'main' } },
];

test('completion があれば phase は done になる', () => {
  const histories = [...finishedHistories(), { at: at(5), kind: 'completion', task: null, data: { forced: false } }];
  assert.equal(computeStatus(docOf([], histories)).phase, 'done');
});

test('completion の data は forced（真偽値）が必要', () => {
  assert.deepEqual(validateEntry({ kind: 'completion', task: null, data: { forced: false } }), []);
  assert.ok(validateEntry({ kind: 'completion', task: null, data: {} }).length > 0);
});

const writeProgress = (tasksDir, name, histories) => {
  const dir = path.join(tasksDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const doc = docOf([], histories);
  doc.status = computeStatus(doc);
  fs.writeFileSync(path.join(dir, 'progress.json'), JSON.stringify(doc));
  return dir;
};

test('pr-created のタスクは完了にすると _done/ へ移り、一覧から消える', () => {
  withTasksDir((root, tasksDir) => {
    const dir = writeProgress(tasksDir, '#42 受注サマリ', finishedHistories());
    const result = completeTask(dir);
    assert.equal(result.phase, 'done');
    assert.equal(result.to, path.join(tasksDir, '_done', '#42 受注サマリ'));
    assert.equal(fs.existsSync(dir), false);
    const moved = JSON.parse(fs.readFileSync(path.join(result.to, 'progress.json'), 'utf8'));
    assert.equal(moved.status.phase, 'done');
    assert.equal(moved.histories.at(-1).data.forced, false);
    assert.deepEqual(listTasks(root).tasks, []);
  });
});

test('pr-created でなければ --force 無しでは何も変えずに失敗し、付ければ完了にできる', () => {
  withTasksDir((root, tasksDir) => {
    const histories = finishedHistories().slice(0, 3);
    const dir = writeProgress(tasksDir, '#43 実装中', histories);
    const before = fs.readFileSync(path.join(dir, 'progress.json'), 'utf8');
    assert.throws(() => completeTask(dir), /--force/);
    assert.equal(fs.readFileSync(path.join(dir, 'progress.json'), 'utf8'), before);
    const result = completeTask(dir, { force: true });
    const moved = JSON.parse(fs.readFileSync(path.join(result.to, 'progress.json'), 'utf8'));
    assert.equal(moved.histories.at(-1).data.forced, true);
  });
});

test('移動先に同名のフォルダがあれば失敗する', () => {
  withTasksDir((root, tasksDir) => {
    const dir = writeProgress(tasksDir, '#44 同名', finishedHistories());
    fs.mkdirSync(path.join(tasksDir, '_done', '#44 同名'), { recursive: true });
    assert.throws(() => completeTask(dir), /同名/);
    assert.equal(fs.existsSync(dir), true);
  });
});

test('タスク置き場の直下でない、または progress.json の無いディレクトリは完了にできない', () => {
  withTasksDir((root, tasksDir) => {
    const nested = writeProgress(path.join(tasksDir, '_done'), '#45 完了済み', finishedHistories());
    assert.throws(() => completeTask(nested), /直下/);
    const memo = path.join(tasksDir, 'メモ置き場');
    fs.mkdirSync(memo);
    assert.throws(() => completeTask(memo), /progress\.json/);
  });
});

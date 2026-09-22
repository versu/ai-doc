import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { defaults, mergeConfig, resolveDocPath, loadConfig, CONFIG_RELATIVE_PATH } from './config.mjs';

function withRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestration-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const writeConfig = (dir, config) => {
  fs.mkdirSync(path.join(dir, '.ai'), { recursive: true });
  fs.writeFileSync(path.join(dir, CONFIG_RELATIVE_PATH), JSON.stringify(config));
};

test('既定値は雛形と一致し、そのまま妥当である', () => {
  const { errors } = mergeConfig(defaults());
  assert.deepEqual(errors, []);
  assert.equal(defaults().review.roundCap, 3);
});

test('欠けたキーは既定値で補う', () => {
  const { config, errors } = mergeConfig({ review: { roundCap: 5 } });
  assert.deepEqual(errors, []);
  assert.equal(config.review.roundCap, 5);
  assert.equal(config.orchestrator.createIssue, 'ask');
  assert.ok(config.implementation.docs.length > 0);
});

test('createIssue に想定外の値が入っていれば弾く', () => {
  const { errors } = mergeConfig({ orchestrator: { createIssue: 'yes' } });
  assert.ok(errors.some((e) => e.includes('createIssue')));
});

test('roundCap が 0 以下や小数なら弾く', () => {
  assert.ok(mergeConfig({ review: { roundCap: 0 } }).errors.some((e) => e.includes('roundCap')));
  assert.ok(mergeConfig({ review: { roundCap: 1.5 } }).errors.some((e) => e.includes('roundCap')));
});

test('実装スキルに commit を指定したら弾く', () => {
  const { errors } = mergeConfig({ implementation: { skills: ['core:commit'] } });
  assert.ok(errors.some((e) => e.includes('commit')));
});

test('相対パスはリポジトリルートを起点に解決する', () => {
  assert.equal(resolveDocPath('.ai/_docs/coding.md', '/repo'), '/repo/.ai/_docs/coding.md');
});

test('絶対パスとチルダはそのまま扱う', () => {
  assert.equal(resolveDocPath('/etc/rule.md', '/repo'), '/etc/rule.md');
  assert.equal(resolveDocPath('~/rule.md', '/repo'), path.join(os.homedir(), '/rule.md'));
});

test('設定ファイルが無ければ ok:false と理由を返す（例外にしない）', () => {
  withRepo((dir) => {
    const result = loadConfig(dir);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'not-initialized');
    assert.ok(result.message.includes('init'));
  });
});

test('壊れた JSON は理由つきで返す', () => {
  withRepo((dir) => {
    fs.mkdirSync(path.join(dir, '.ai'), { recursive: true });
    fs.writeFileSync(path.join(dir, CONFIG_RELATIVE_PATH), '{ broken');
    assert.equal(loadConfig(dir).reason, 'invalid-json');
  });
});

test('存在しない docs は missingDocs に入るが、読み込み自体は成功する', () => {
  withRepo((dir) => {
    writeConfig(dir, { implementation: { docs: ['docs/ある.md', 'docs/ない.md'] }, review: { docs: [] } });
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs/ある.md'), '# ある');
    const result = loadConfig(dir);
    assert.equal(result.ok, true);
    assert.deepEqual(result.missingDocs, ['docs/ない.md']);
    assert.equal(result.implementation.docs.find((d) => d.path === 'docs/ある.md').exists, true);
  });
});

test('値が不正なら ok:false で止める（既定値で握りつぶさない）', () => {
  withRepo((dir) => {
    writeConfig(dir, { review: { roundCap: -1 } });
    const result = loadConfig(dir);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid-value');
  });
});

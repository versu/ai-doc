import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createDocSettings, loadDocSettings, settingsPathOf, validateDocSettings } from './skill-settings.mjs';

const SKILL = 'create-gh-pr';

function withRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-settings-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const writeSettings = (dir, content) => {
  const settingsPath = settingsPathOf(dir, SKILL);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, typeof content === 'string' ? content : JSON.stringify(content));
};

const writeFile = (dir, relative) => {
  fs.mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
  fs.writeFileSync(path.join(dir, relative), '# 中身');
};

const CLI = fileURLToPath(new URL('../skills/create-gh-pr/scripts/settings.mjs', import.meta.url));
const runCli = (command, dir) => spawnSync(process.execPath, [CLI, command, '--repo', dir], { encoding: 'utf8' });

test('置き場所はスキルごとのフォルダ', () => {
  assert.equal(settingsPathOf('/repo', SKILL), '/repo/.ai/_settings/create-gh-pr/settings.json');
});

test('設定ファイルが無ければ既定（テンプレート無し・追加の規約無し）で ok', () => {
  withRepo((dir) => {
    const result = loadDocSettings(SKILL, dir);
    assert.equal(result.ok, true);
    assert.equal(result.exists, false);
    assert.equal(result.template, null);
    assert.deepEqual(result.docs, []);
  });
});

test('テンプレートと規約はリポジトリルートを起点に解決する', () => {
  withRepo((dir) => {
    writeFile(dir, '.ai/_settings/create-gh-pr/template.md');
    writeFile(dir, 'docs/pr-rule.md');
    writeSettings(dir, { template: '.ai/_settings/create-gh-pr/template.md', docs: ['docs/pr-rule.md'] });
    const result = loadDocSettings(SKILL, dir);
    assert.equal(result.ok, true);
    assert.equal(result.template.resolved, path.join(dir, '.ai/_settings/create-gh-pr/template.md'));
    assert.equal(result.docs[0].resolved, path.join(dir, 'docs/pr-rule.md'));
  });
});

test('欠けたキーは既定で補う', () => {
  withRepo((dir) => {
    writeSettings(dir, {});
    const result = loadDocSettings(SKILL, dir);
    assert.equal(result.ok, true);
    assert.equal(result.template, null);
    assert.deepEqual(result.docs, []);
  });
});

test('壊れた JSON は invalid-json で止める', () => {
  withRepo((dir) => {
    writeSettings(dir, '{ broken');
    assert.equal(loadDocSettings(SKILL, dir).reason, 'invalid-json');
  });
});

test('値の問題は1件で止めず、すべて列挙する', () => {
  const errors = validateDocSettings({ tempalte: 'x', template: '', docs: [1] });
  assert.equal(errors.length, 3);
  assert.ok(errors.some((e) => e.startsWith('tempalte:')));
  assert.ok(errors.some((e) => e.startsWith('template:')));
  assert.ok(errors.some((e) => e.startsWith('docs:')));
});

test('最上位がオブジェクトでなければ弾く', () => {
  assert.equal(validateDocSettings([]).length, 1);
});

test('存在しないファイルは missing-docs で止め、無いものだけを挙げる', () => {
  withRepo((dir) => {
    writeFile(dir, 'docs/ある.md');
    writeSettings(dir, { template: 'docs/ない雛形.md', docs: ['docs/ある.md', 'docs/ない.md'] });
    const result = loadDocSettings(SKILL, dir);
    assert.equal(result.reason, 'missing-docs');
    assert.equal(result.errors.length, 2);
    assert.ok(result.errors.some((e) => e.startsWith('template:') && e.includes('docs/ない雛形.md')));
    assert.ok(result.errors.some((e) => e.startsWith('docs:') && e.includes('docs/ない.md')));
  });
});

test('createDocSettings は雛形を書き出し、既にあれば上書きしない', () => {
  withRepo((dir) => {
    const created = createDocSettings(SKILL, dir);
    assert.equal(created.created, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(created.settingsPath, 'utf8')), { template: null, docs: [] });

    const edited = { docs: ['docs/pr-rule.md'] };
    fs.writeFileSync(created.settingsPath, JSON.stringify(edited));
    const again = createDocSettings(SKILL, dir);
    assert.equal(again.created, false);
    assert.equal(again.reason, 'already-exists');
    assert.deepEqual(JSON.parse(fs.readFileSync(created.settingsPath, 'utf8')), edited);
  });
});

test('CLI の show は問題があっても終了コード0、check は1', () => {
  withRepo((dir) => {
    writeSettings(dir, { docs: 'docs/pr-rule.md' });
    const show = runCli('show', dir);
    assert.equal(show.status, 0);
    assert.equal(JSON.parse(show.stdout).ok, false);
    const check = runCli('check', dir);
    assert.equal(check.status, 1);
    assert.equal(JSON.parse(check.stdout).reason, 'invalid-value');
  });
});

test('CLI の check は問題が無ければ終了コード0', () => {
  withRepo((dir) => {
    const check = runCli('check', dir);
    assert.equal(check.status, 0);
    assert.equal(JSON.parse(check.stdout).ok, true);
  });
});

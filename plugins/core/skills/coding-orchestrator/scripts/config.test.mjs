import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { defaults, initialConfig, createConfig, mergeConfig, resolveDocPath, loadConfig, CONFIG_RELATIVE_PATH } from './config.mjs';

function withRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestration-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const writeConfigOnly = (dir, config) => {
  fs.mkdirSync(path.dirname(path.join(dir, CONFIG_RELATIVE_PATH)), { recursive: true });
  fs.writeFileSync(path.join(dir, CONFIG_RELATIVE_PATH), JSON.stringify(config));
};

/** 設定ファイルと、既定の規約ファイル（aidoc install が用意するもの）を置く。 */
const writeConfig = (dir, config) => {
  writeConfigOnly(dir, config);
  const base = defaults();
  for (const doc of new Set([...base.implementation.docs, ...base.review.docs])) {
    fs.mkdirSync(path.dirname(path.join(dir, doc)), { recursive: true });
    fs.writeFileSync(path.join(dir, doc), '# 既定の規約');
  }
};

const CONFIG_SCRIPT = fileURLToPath(new URL('./config.mjs', import.meta.url));
const runCheck = (dir) => spawnSync(process.execPath, [CONFIG_SCRIPT, 'check', '--repo', dir], { encoding: 'utf8' });

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
    writeConfigOnly(dir, {});
    fs.writeFileSync(path.join(dir, CONFIG_RELATIVE_PATH), '{ broken');
    assert.equal(loadConfig(dir).reason, 'invalid-json');
  });
});

test('存在しない docs があれば missing-docs で止め、無いものだけを挙げる', () => {
  withRepo((dir) => {
    writeConfig(dir, { implementation: { docs: ['docs/ある.md', 'docs/ない.md'] } });
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs/ある.md'), '# ある');
    const result = loadConfig(dir);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing-docs');
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0].startsWith('implementation.docs:'));
    assert.ok(result.errors[0].includes('docs/ない.md'));
  });
});

test('既定の規約が無ければ止め、aidoc install の確認を促す', () => {
  withRepo((dir) => {
    writeConfigOnly(dir, {});
    const result = loadConfig(dir);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing-docs');
    assert.ok(result.errors.every((e) => e.includes('aidoc install')));
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

test('implementation.docs と review.docs は既定に追加する（上書きしない）', () => {
  const base = defaults();
  const { config, errors } = mergeConfig({ implementation: { docs: ['docs/php.md'] }, review: { docs: ['docs/review.md'] } });
  assert.deepEqual(errors, []);
  assert.deepEqual(config.implementation.docs, [...base.implementation.docs, 'docs/php.md']);
  assert.deepEqual(config.review.docs, [...base.review.docs, 'docs/review.md']);
});

test('既定と同じ規約を書いても二重にならない', () => {
  const base = defaults();
  const { config } = mergeConfig({ implementation: { docs: [...base.implementation.docs, 'docs/php.md'] } });
  assert.deepEqual(config.implementation.docs, [...base.implementation.docs, 'docs/php.md']);
});

test('init の雛形は docs を空にし、それ以外は既定値のまま', () => {
  const content = initialConfig();
  assert.deepEqual(content.implementation.docs, []);
  assert.deepEqual(content.review.docs, []);
  assert.equal(content.review.roundCap, defaults().review.roundCap);
  assert.ok(defaults().implementation.docs.length > 0);
});

test('createConfig は雛形を書き出し、既にあれば上書きしない', () => {
  withRepo((dir) => {
    const created = createConfig(dir);
    assert.equal(created.created, true);
    assert.equal(created.configPath, path.join(dir, CONFIG_RELATIVE_PATH));
    assert.deepEqual(JSON.parse(fs.readFileSync(created.configPath, 'utf8')), initialConfig());

    const edited = { review: { roundCap: 5 } };
    fs.writeFileSync(created.configPath, JSON.stringify(edited));
    const again = createConfig(dir);
    assert.equal(again.created, false);
    assert.equal(again.reason, 'already-exists');
    assert.deepEqual(again.content, edited);
    assert.deepEqual(JSON.parse(fs.readFileSync(created.configPath, 'utf8')), edited);
  });
});

test('未知のキーはトップレベルでもセクション内でも弾く', () => {
  const { errors } = mergeConfig({ implemntation: {}, review: { roundcap: 2 } });
  assert.ok(errors.some((e) => e.startsWith('implemntation:')));
  assert.ok(errors.some((e) => e.startsWith('review.roundcap:')));
});

test('最上位やセクションがオブジェクトでなければ弾く', () => {
  assert.ok(mergeConfig([]).errors.length > 0);
  assert.ok(mergeConfig({ review: [] }).errors.some((e) => e.startsWith('review:')));
});

test('配列の要素が空でない文字列でなければ弾く', () => {
  const { errors } = mergeConfig({ implementation: { docs: [1, ''] }, review: { skills: [null] } });
  assert.ok(errors.some((e) => e.startsWith('implementation.docs:')));
  assert.ok(errors.some((e) => e.startsWith('review.skills:')));
});

test('設定ファイルの置き場所は .ai/_settings/coding-orchestrator/settings.json', () => {
  assert.equal(CONFIG_RELATIVE_PATH, path.join('.ai', '_settings', 'coding-orchestrator', 'settings.json'));
});

test('問題は1件で止めず、すべて列挙する', () => {
  const { errors } = mergeConfig({ orchestrator: { createIssue: 'yes' }, review: { roundCap: 0 }, typo: 1 });
  assert.equal(errors.length, 3);
});

test('check は問題が無ければ終了コード0', () => {
  withRepo((dir) => {
    writeConfig(dir, {});
    const run = runCheck(dir);
    assert.equal(run.status, 0);
    assert.equal(JSON.parse(run.stdout).ok, true);
  });
});

test('check は問題があれば終了コード1で、理由をすべて返す', () => {
  withRepo((dir) => {
    writeConfig(dir, { review: { roundCap: 0 }, typo: 1 });
    const run = runCheck(dir);
    assert.equal(run.status, 1);
    const report = JSON.parse(run.stdout);
    assert.equal(report.reason, 'invalid-value');
    assert.equal(report.errors.length, 2);
  });
});

test('check は設定ファイルが無ければ終了コード1で、作成コマンドを返す', () => {
  withRepo((dir) => {
    const run = runCheck(dir);
    assert.equal(run.status, 1);
    const report = JSON.parse(run.stdout);
    assert.equal(report.reason, 'not-initialized');
    assert.ok(report.initCommand.includes('init'));
  });
});

/** 呼び出し先スキル（Issue・PR 作成）の設定ファイルを置く。 */
const writeSkillSettings = (dir, skill, content) => {
  const settingsPath = path.join(dir, '.ai', '_settings', skill, 'settings.json');
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, typeof content === 'string' ? content : JSON.stringify(content));
};

test('check は呼び出し先スキルの設定も検証し、問題があれば invalid-skill-settings で止める', () => {
  withRepo((dir) => {
    writeConfig(dir, {});
    writeSkillSettings(dir, 'create-gh-pr', { template: 'docs/ない.md' });
    writeSkillSettings(dir, 'create-gh-issue', { tempalte: null });
    const run = runCheck(dir);
    assert.equal(run.status, 1);
    const report = JSON.parse(run.stdout);
    assert.equal(report.reason, 'invalid-skill-settings');
    assert.equal(report.errors.length, 2);
    assert.ok(report.errors.some((e) => e.startsWith('create-gh-pr') && e.includes('docs/ない.md')));
    assert.ok(report.errors.some((e) => e.startsWith('create-gh-issue') && e.includes('tempalte')));
  });
});

test('check はオーケストレーター側の問題を優先して reason に出し、呼び出し先の問題も合わせて返す', () => {
  withRepo((dir) => {
    writeConfig(dir, { review: { roundCap: 0 } });
    writeSkillSettings(dir, 'create-gh-pr', '{ broken');
    const report = JSON.parse(runCheck(dir).stdout);
    assert.equal(report.reason, 'invalid-value');
    assert.ok(report.errors.some((e) => e.startsWith('review.roundCap:')));
    assert.ok(report.errors.some((e) => e.startsWith('create-gh-pr')));
  });
});

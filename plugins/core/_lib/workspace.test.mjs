import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { initRepo, withWorkspace } from './test-workspace.mjs';
import { loadWorkspace, stripJsonc, unsyncedRepos } from './workspace.mjs';

test('JSONC のコメントと末尾のカンマを取り除く。文字列の中身には触らない', () => {
  const text = `{
    // 行コメント
    "folders": [ /* 範囲コメント */ { "path": "../a//b", "name": "x/*y*/" }, ],
  }`;
  assert.deepEqual(JSON.parse(stripJsonc(text)), { folders: [{ path: '../a//b', name: 'x/*y*/' }] });
});

test('.code-workspace が無ければ単一リポジトリモード', () => {
  withWorkspace(({ hub }) => {
    const ws = loadWorkspace(hub);
    assert.equal(ws.ok, true);
    assert.equal(ws.mode, 'single');
    assert.deepEqual(ws.repos, {});
  }, { workspace: null });
});

test('ハブ自身と git でないフォルダを除き、リポジトリをフォルダ名で並べる', () => {
  withWorkspace(({ root, hub, repos }) => {
    fs.mkdirSync(path.join(root, 'notes'));
    fs.writeFileSync(path.join(hub, 'ws.code-workspace'), JSON.stringify({
      folders: [{ path: '.' }, { path: '../api' }, { path: '../web' }, { path: '../notes' }],
    }));
    const ws = loadWorkspace(hub);
    assert.equal(ws.ok, true);
    assert.equal(ws.mode, 'multi');
    assert.deepEqual(ws.repos, { api: { path: '../api', resolved: repos.api }, web: { path: '../web', resolved: repos.web } });
  });
});

test('name があればそれをリポジトリ名にする', () => {
  withWorkspace(({ hub }) => {
    assert.deepEqual(Object.keys(loadWorkspace(hub).repos), ['backend']);
  }, { repos: ['api'], folders: [{ path: '../api', name: 'backend' }] });
});

test('ハブと同じリポジトリのフォルダは対象にしない（モノレポのサブフォルダを並べた場合）', () => {
  withWorkspace(({ hub }) => {
    initRepo(hub);
    fs.mkdirSync(path.join(hub, 'packages', 'a'), { recursive: true });
    fs.writeFileSync(path.join(hub, 'ws.code-workspace'), JSON.stringify({ folders: [{ path: '.' }, { path: 'packages/a' }] }));
    const ws = loadWorkspace(hub);
    assert.equal(ws.mode, 'single');
    assert.equal(ws.ok, true);
  }, { repos: [] });
});

test('リポジトリ名の重複・使えない文字・存在しないフォルダはエラーにする', () => {
  withWorkspace(({ hub }) => {
    const ws = loadWorkspace(hub);
    assert.equal(ws.ok, false);
    assert.equal(ws.errors.length, 3);
    assert.match(ws.errors.join('\n'), /重複/);
    assert.match(ws.errors.join('\n'), /#・空白/);
    assert.match(ws.errors.join('\n'), /フォルダがありません/);
  }, {
    folders: [
      { path: '../api', name: 'app' },
      { path: '../web', name: 'app' },
      { path: '../api', name: 'my app' },
      { path: '../none' },
    ],
  });
});

test('.code-workspace が複数あればエラーにする', () => {
  withWorkspace(({ hub }) => {
    fs.writeFileSync(path.join(hub, 'other.code-workspace'), '{ "folders": [] }');
    const ws = loadWorkspace(hub);
    assert.equal(ws.ok, false);
    assert.match(ws.errors[0], /複数/);
  });
});

test('ハブからファイルアクセスを許可していないリポジトリを返す。相対パスで許可していてもよい', () => {
  withWorkspace(({ hub }) => {
    assert.deepEqual(unsyncedRepos(loadWorkspace(hub)), ['api', 'web']);
    fs.mkdirSync(path.join(hub, '.claude'));
    fs.writeFileSync(path.join(hub, '.claude', 'settings.local.json'), JSON.stringify({ permissions: { additionalDirectories: ['../api'] } }));
    assert.deepEqual(unsyncedRepos(loadWorkspace(hub)), ['web']);
  }, { synced: false });
});

test('単一リポジトリモードでは、ファイルアクセスの許可を求めない', () => {
  withWorkspace(({ hub }) => {
    assert.deepEqual(unsyncedRepos(loadWorkspace(hub)), []);
  }, { workspace: null, synced: false });
});

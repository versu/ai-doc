/**
 * VS Code のマルチルートワークスペース（*.code-workspace）から、横断して作業する対象リポジトリを読み取る。
 *
 * ハブ（.code-workspace と .ai/ を置くフォルダ）から複数のリポジトリを扱うとき、
 * 「.ai/ を置く場所」と「git 操作をする場所」が分かれる。どのリポジトリを扱うかの一覧は
 * .code-workspace の folders をそのまま使い、専用の設定ファイルは持たない。二重に持つとずれるため。
 *
 * .code-workspace が無い、または対象リポジトリが0件なら単一リポジトリモード（従来どおり）。
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRootOf } from './skill-settings.mjs';

const WORKSPACE_EXTENSION = '.code-workspace';

/** タスクフォルダ名の先頭に付けるので、区切りに使う文字（#・空白）とパス区切り文字は使えない */
const INVALID_KEY_PATTERN = /[\s#/\\]/;

/**
 * JSONC（コメントと末尾のカンマを許す JSON）を JSON.parse できる形にする。
 * .code-workspace は VS Code が JSONC として扱うため。文字列の中身には触らない。
 */
export function stripJsonc(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += c;
      i += 1;
    }
  }
  // 末尾のカンマ（, の直後が空白を挟んで } か ]）を取り除く。文字列はこの時点で残っているが、
  // 文字列の中に「,」に続けて「}」が現れる形は .code-workspace の folders では実用上ないので割り切る
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function gitTopLevelOf(dir) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const samePath = (a, b) => path.resolve(a) === path.resolve(b);

/**
 * ハブの .code-workspace を読み、対象リポジトリを返す。
 *
 * 対象から除くもの:
 * - git リポジトリでないフォルダ（ブランチも PR も作れないため）
 * - ハブと同じリポジトリに属するフォルダ（ハブ自身や、モノレポのサブフォルダを並べただけの場合）
 *
 * 問題は例外にせず errors に集める。設定の検証で他の問題とまとめて示すため。
 */
export function loadWorkspace(cwd) {
  const hubRoot = repoRootOf(cwd);
  const single = (workspaceFile = null) => ({ ok: true, mode: 'single', hubRoot, workspaceFile, repos: {}, errors: [] });

  let entries;
  try {
    entries = fs.readdirSync(hubRoot).filter((name) => name.endsWith(WORKSPACE_EXTENSION));
  } catch {
    return single();
  }
  if (entries.length === 0) return single();
  if (entries.length > 1) {
    return {
      ...single(),
      ok: false,
      errors: [`${hubRoot} に ${WORKSPACE_EXTENSION} が複数あります（${entries.join(', ')}）。どれを使うか決められないため、1つにしてください`],
    };
  }

  const workspaceFile = path.join(hubRoot, entries[0]);
  let raw;
  try {
    raw = JSON.parse(stripJsonc(fs.readFileSync(workspaceFile, 'utf8')));
  } catch (e) {
    return { ...single(workspaceFile), ok: false, errors: [`${workspaceFile}: JSON として読めません: ${e.message}`] };
  }
  const folders = raw?.folders;
  if (!Array.isArray(folders)) {
    return { ...single(workspaceFile), ok: false, errors: [`${workspaceFile}: folders が配列ではありません`] };
  }

  const errors = [];
  const repos = {};
  const hubTopLevel = gitTopLevelOf(hubRoot);
  for (const [i, folder] of folders.entries()) {
    if (typeof folder?.path !== 'string' || folder.path.trim() === '') {
      errors.push(`${workspaceFile}: folders[${i}].path が文字列ではありません`);
      continue;
    }
    const resolved = path.resolve(path.dirname(workspaceFile), folder.path);
    if (!fs.existsSync(resolved)) {
      errors.push(`${workspaceFile}: folders[${i}] のフォルダがありません: ${resolved}`);
      continue;
    }
    const topLevel = gitTopLevelOf(resolved);
    if (topLevel === null) continue;
    if (hubTopLevel !== null && samePath(topLevel, hubTopLevel)) continue;

    const key = typeof folder.name === 'string' && folder.name.trim() !== '' ? folder.name.trim() : path.basename(topLevel);
    if (INVALID_KEY_PATTERN.test(key)) {
      errors.push(`${workspaceFile}: folders[${i}] のリポジトリ名「${key}」に #・空白・パス区切り文字は使えません（タスクフォルダ名の先頭に付けるため）。name で別の名前を付けてください`);
      continue;
    }
    if (repos[key]) {
      errors.push(`${workspaceFile}: リポジトリ名「${key}」が重複しています（${repos[key].resolved} と ${topLevel}）。name で別の名前を付けてください`);
      continue;
    }
    if (Object.values(repos).some((r) => samePath(r.resolved, topLevel))) {
      errors.push(`${workspaceFile}: 同じリポジトリが2回並んでいます: ${topLevel}`);
      continue;
    }
    repos[key] = { path: folder.path, resolved: topLevel };
  }

  const mode = Object.keys(repos).length > 0 ? 'multi' : 'single';
  return { ok: errors.length === 0, mode, hubRoot, workspaceFile, repos, errors };
}

/** ハブの Claude Code の設定で、ファイルアクセスを許可しているディレクトリ（実体のパス）。 */
function allowedDirectoriesOf(hubRoot) {
  const allowed = new Set();
  for (const name of ['settings.local.json', 'settings.json']) {
    const file = path.join(hubRoot, '.claude', name);
    let settings;
    try {
      settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    for (const dir of settings?.permissions?.additionalDirectories ?? []) {
      if (typeof dir !== 'string') continue;
      const resolved = path.resolve(hubRoot, dir.startsWith('~') ? path.join(os.homedir(), dir.slice(1)) : dir);
      try {
        allowed.add(fs.realpathSync(resolved));
      } catch {
        allowed.add(resolved);
      }
    }
  }
  return allowed;
}

/**
 * ハブからファイルアクセスを許可していない対象リポジトリの名前を返す。
 * .code-workspace にリポジトリを足したのに aidoc workspace sync を忘れると、ハブから読み書きするたびに
 * 許可を求められ、サブエージェントは失敗することがある。起動時に気づけるよう、設定の検証から呼ぶ。
 */
export function unsyncedRepos(workspace) {
  if (workspace.mode !== 'multi') return [];
  const allowed = allowedDirectoriesOf(workspace.hubRoot);
  return Object.entries(workspace.repos)
    .filter(([, repo]) => !allowed.has(repo.resolved))
    .map(([key]) => key);
}

---
name: create-gh-pr
description: GitHub の Pull Request を作成するスキル。作業ブランチを push し、宛先ブランチを指定して PR を作る。「PR を作って」「プルリク出して」「レビューに出して」等のときに使用する。作成前に必ず内容を提示して合意を取り、希望があれば本文をファイルに書き出して編集してもらってから作成する。本文は人間のレビュアーが読む前提で、ドメイン用語で書く。
allowed-tools:
  - AskUserQuestion
  - Bash(gh --version)
  - Bash(gh auth status:*)
  - Bash(gh pr create:*)
  - Bash(gh pr view:*)
  - Bash(git push:*)
  - Bash(git status:*)
  - Bash(git log:*)
  - Bash(git rev-parse:*)
---

# Pull Request の作成

## 渡されるもの

| 項目 | 省略時・扱い |
|---|---|
| 宛先（base）ブランチ | リポジトリの既定ブランチ。**積み上げ（stacked PR）では直前のタスクのブランチ**になるので、呼び出し側の指定に従う |
| タイトル | 本文から起こして確認する |
| 本文（または spec と Issue 番号） | spec と直近のコミットから組み立てる |
| draft か否か | draft にしない |
| 担当者 | **自分（`@me`）。** 空だとレビュー待ちの一覧で誰が面倒を見るのか分からなくなる |

## 手順

**下の「停止条件」に当たったら、作らずに理由を報告して止まる。**

### 1. 前提を確認する

```bash
gh auth status
git status --porcelain            # 未コミットの変更が無いこと
git log --oneline <base>..HEAD    # コミットが1つ以上あること
```

### 2. 本文を組み立てる

[references/pr-template.md](references/pr-template.md) の構成に従い、
[references/pr-writing.md](references/pr-writing.md) の書き方を守る。

### 3. 内容を提示して合意を取る

**内容を見せずに作らない。** `AskUserQuestion` で選んでもらう。

| 選択肢 | すること |
|---|---|
| **OK** | 提示した内容でそのまま作成する |
| **内容を出力** | `.ai/_tasks/<タスク名>/pr-<タスクid>.md` に書き出す（タスクフォルダが分からなければ出力先を聞く）。ユーザーが編集したあと、**もう一度確認してから作成する** |

書き出した場合は**ファイルの現在の内容**をそのまま使う。提示したときの内容を使い回さない
（編集を取りこぼすため）。**1行目の `# ` 見出しをタイトル**、それ以降を本文として扱う。

### 4. 作業ブランチを push する

```bash
git push -u origin HEAD
```

**合意が取れてから push する。** 先に push すると、内容を見たユーザーが
「やっぱりやめる」と言ったときに、リモートに中途半端なブランチだけが残る。

### 5. 作成する

```bash
gh pr create --base <宛先ブランチ> --title "<タイトル>" --body-file <path> --assignee "@me"
```

担当者（`--assignee`）とレビュアー（`--reviewer`）は別物なので混同しない。

## 停止条件

| 条件 | 理由 |
|---|---|
| `gh` が未認証 | 作れないため |
| 未コミットの変更がある | PR の差分に入らない変更が手元に残るため |
| `<base>..HEAD` にコミットが無い | 空の PR になるため |
| push できない | 合意のあとに push するので、ここで止まったら PR は作らない |

## 返すもの

作成した PR の番号。宛先が既定ブランチでない場合は、**マージ順**もあわせて伝える。

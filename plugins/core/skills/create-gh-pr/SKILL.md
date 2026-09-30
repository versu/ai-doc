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
  - Bash(git fetch:*)
  - Bash(git merge-base:*)
  - Bash(git rebase:*)
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
| 本文のテンプレート（ファイルのパス） | [references/pr-template.md](references/pr-template.md) |
| 追加の規約（ファイルのパスの配列） | なし（[references/pr-writing.md](references/pr-writing.md) だけを守る） |
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

本文のテンプレート（渡されなければ [references/pr-template.md](references/pr-template.md)）の構成に従い、
[references/pr-writing.md](references/pr-writing.md) の書き方を守る。

- 渡されたテンプレートは**本文の構成**として使う。タイトルはテンプレートに無くても別に起こす
- 追加の規約が渡されたら、`pr-writing.md` に加えてそれも読んで守る。**食い違ったら追加の規約を優先する**
  （プロジェクトごとの決まりのほうが、ここにある一般的な基準より具体的なため）
- 「Generated with Claude Code」などの生成元の表記は付けない。本文はテンプレートの構成どおりの内容だけにする

### 3. 内容を提示して合意を取る

**内容を見せずに作らない。** `AskUserQuestion` で選んでもらう。

| 選択肢 | すること |
|---|---|
| **OK** | 提示した内容でそのまま作成する |
| **内容を出力** | `.ai/_tasks/<タスク名>/pr-<タスクid>.md` に書き出す（タスクフォルダが分からなければ出力先を聞く）。ユーザーが編集したあと、**もう一度確認してから作成する** |

書き出した場合は**ファイルの現在の内容**をそのまま使う。提示したときの内容を使い回さない
（編集を取りこぼすため）。**1行目の `# ` 見出しをタイトル**、それ以降を本文として扱う。

### 4. base を最新化し、作業ブランチを rebase する

base に更新があれば、取り込んでから push する。
古い base のまま PR を出すと、他の変更との競合がレビューのあとまで見つからないため。

```bash
git rev-parse --abbrev-ref <base>@{upstream}   # 上流が無ければ失敗する。そのときはこの手順を飛ばす
git fetch origin <base>:<base>                  # base を早送りで最新化する
git merge-base --is-ancestor <base> HEAD        # 成功すれば更新は取り込み済みなので、rebase しない
git rebase <base>
```

- 上流が無い base（積み上げで、直前のタスクのブランチがまだ push されていない場合）は最新化しない
- 作業ブランチが既にリモートにある（`git rev-parse --abbrev-ref HEAD@{upstream}` が成功する）場合は、
  rebase すると force push が必要になる。rebase する前に `AskUserQuestion` で、
  rebase して push するか、rebase せずに進めるかを選んでもらう
- rebase で競合したら、`git rebase --abort` で元に戻して止まる。競合の解き方はコードの意図に関わるため、人が判断する

### 5. 作業ブランチを push する

```bash
git push -u origin HEAD
```

手順4で、リモートにある作業ブランチを rebase した場合だけ `git push --force-with-lease -u origin HEAD` にする。

**合意が取れてから push する。** 先に push すると、内容を見たユーザーが
「やっぱりやめる」と言ったときに、リモートに中途半端なブランチだけが残る。

### 6. 作成する

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
| base を早送りで最新化できない | ローカルの base がリモートと分岐している。人が判断すべき状況のため |
| rebase で競合した | 競合の解き方はコードの意図に関わるため |
| push できない | 合意のあとに push するので、ここで止まったら PR は作らない |

## 返すもの

作成した PR の番号。宛先が既定ブランチでない場合は、**マージ順**もあわせて伝える。
手順4で rebase した場合は、その旨も伝える。rebase 前に流したテストの結果は、rebase 後のコードには当てはまらないため。

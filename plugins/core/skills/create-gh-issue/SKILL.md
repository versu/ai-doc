---
name: create-gh-issue
description: GitHub の Issue を作成するスキル。親を指定したサブ Issue の作成にも対応する。「Issue を作って」「これを課題として起票して」「サブIssueに分けて登録して」等のときに使用する。作成前に必ず内容を提示して合意を取り、希望があれば本文をファイルに書き出して編集してもらってから作成する。
allowed-tools:
  - AskUserQuestion
  - Bash(node:*)
  - Bash(gh --version)
  - Bash(gh auth status:*)
  - Bash(gh issue create:*)
  - Bash(gh issue edit:*)
  - Bash(gh issue view:*)
---

# Issue の作成

## 起動時点の設定

!`node ${CLAUDE_SKILL_DIR}/scripts/settings.mjs show`

プロジェクトの設定ファイル `.ai/_settings/create-gh-issue/settings.json` を、パスの解決と存在確認まで済ませたもの。
**自分で設定ファイルを読み直さない。** 上に JSON が無ければインラインが権限で拒否されているので、同じコマンドを Bash で実行する。

| 項目 | 意味 |
|---|---|
| `template` | 本文のテンプレート。`null` なら [references/issue-template.md](references/issue-template.md) の雛形を使う |
| `docs` | テクニカルライティング規約に追加で読ませる規約 |

設定ファイルが無いときも `ok: true` になり、既定のテンプレートと規約だけを使う。

## 渡されるもの

| 項目 | 省略時・扱い |
|---|---|
| タイトル | 本文から起こして確認する |
| 本文（または spec のパス） | ユーザーに確認する |
| 親 Issue の番号 | 親を持たない Issue として作る |
| ラベル | 付けない |
| 担当者 | **自分（`@me`）。** 空だと一覧で誰が抱えているのか分からなくなる。別の人に持たせたいときだけ指定してもらう |

## 手順

**下の「停止条件」に当たったら、作らずに理由を報告して止まる。**

### 1. 前提を確認する

```bash
gh auth status
gh --version        # 親 Issue の番号が渡されたときだけ。サブ Issue を作れるかの判定に使う
```

### 2. 本文を組み立てる

[references/issue-template.md](references/issue-template.md) に従う。
文章はテクニカルライティング規約に沿って書く。

- 設定の `template` があれば、それを**本文の構成**として使う。`issue-template.md` の雛形の代わりになるだけで、
  「方針」と「タイトル」の節は引き続き守る
- 設定の `docs` があれば、それも読んで守る。**食い違ったら `docs` の規約を優先する**
  （プロジェクトごとの決まりのほうが、一般的な基準より具体的なため）

@${CLAUDE_SKILL_DIR}/../../_docs/technical-writing.md

### 3. 内容を提示して合意を取る

**内容を見せずに作らない。** `AskUserQuestion` で選んでもらう。

| 選択肢 | すること |
|---|---|
| **OK** | 提示した内容でそのまま作成する |
| **内容を出力** | `.ai/_tasks/<タスク名>/issue-<タスクid>.md` に書き出す（タスクフォルダが分からなければ出力先を聞く）。ユーザーが編集したあと、**もう一度確認してから作成する** |

書き出した場合は**ファイルの現在の内容**をそのまま使う。提示したときの内容を使い回さない
（編集を取りこぼすため）。**1行目の `# ` 見出しをタイトル**、それ以降を本文として扱う。

### 4. 作成する

```bash
gh issue create --title "<タイトル>" --body-file <path> --assignee "@me"
```

親を指定するときは `--parent <親の番号>` を足す（下の条件を満たす場合）。

## サブ Issue

| やりたいこと | コマンド |
|---|---|
| 親を指定して子 Issue を作る | `gh issue create --parent <親の番号>` |
| 既存の Issue を後から子にする | `gh issue edit <親の番号> --add-sub-issue <子の番号>` |

**必要条件**: `gh` 2.94.0 以上、かつ GitHub.com または GHES 3.17 以上。

満たさないときはサブ Issue の関係を設定せず、
**子 Issue の本文の先頭に `Parent: #<親の番号>` を書いてリンクする**。
そのうえで「`gh` を 2.94.0 以上に上げるとサブ Issue として登録できる」と一度だけ伝える。

**この分岐はこのスキルの中に閉じる。** 呼び出し側には「親を指定して作る」だけに見せる。

## 停止条件

| 条件 | 理由 |
|---|---|
| 起動時点の設定が `ok: false` | 読ませるはずのテンプレートや規約が無いまま書くことになるため。`errors` をすべて示し、`aidoc issue check` で直してから呼び直すよう伝える |
| `gh` が未認証 | 作れないため |
| 渡された親 Issue が存在しない | 取り違えた親にぶら下げてしまうため |

## 返すもの

作成した Issue の番号。フォールバック経路を通ったならその旨も添える。

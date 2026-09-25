# 設定ファイル `.ai/orchestration.json`

読み手はオーケストレーター。現場ごとの差異をここから受け取る。

## 置き場所

参画先リポジトリの `.ai/orchestration.json`。
`.ai/` は `aidoc install` が `.git/info/exclude` に登録しているため、参画先を汚さない。

**このファイルが無ければオーケストレーターは動かない。**
`config.mjs init` で作らせてから進む。既定値で勝手に走らせない理由は、設定の中身が
「この現場でどの規約を読ませるか」そのものだからで、既定のまま走ると現場の規約が
読まれないまま実装とレビューが終わり、あとから気づくことになる。

ファイルはあるがキーが欠けている場合は、そのキーだけ既定値を使う。

## 設定項目

「設定したとき」は、キーを書いた場合に既定値とどう組み合わさるか。

| 項目 | 型 | 取りうる値 | 既定値 | 設定したとき | 意味 |
|---|---|---|---|---|---|
| `orchestrator.createIssue` | 文字列/真偽値 | `"ask"` / `true` / `false` | `"ask"` | 上書き | 準備フェーズの合意後に Issue を起票するか。`"ask"` はその都度確認する |
| `orchestrator.createPullRequest` | 文字列/真偽値 | `"ask"` / `true` / `false` | `"ask"` | 上書き | タスクが1つ終わるたびに PR を作るか |
| `implementation.skills` | 文字列の配列 | スキル名 | `[]` | 上書き | 実装エージェントに使わせるスキル |
| `implementation.docs` | 文字列の配列 | パス | 下記「既定の規約」 | **既定に追加** | 実装エージェントが着手前に必ず読むドキュメント |
| `review.skills` | 文字列の配列 | スキル名 | `[]` | 上書き | レビュアーエージェントに使わせるスキル |
| `review.docs` | 文字列の配列 | パス | 下記「既定の規約」 | **既定に追加** | レビュアーエージェントがレビュー前に必ず読むドキュメント。これがレビュー基準になる |
| `review.roundCap` | 整数 | 1 以上 | `3` | 上書き | 1タスクあたりのレビュー回数の上限 |
| `pullRequest.template` | 文字列/null | パス | `null` | 上書き | PR 本文のテンプレート。`null` なら PR 作成スキルの既定のテンプレート（`create-gh-pr/references/pr-template.md`）を使う |
| `pullRequest.docs` | 文字列の配列 | パス | `[]` | 上書き（既定は空） | PR を書く前に読ませる規約。PR 作成スキルが常に読む `create-gh-pr/references/pr-writing.md` に**追加で**読ませ、食い違えばこちらを優先する |

既定値は [orchestration.default.json](orchestration.default.json) が正本。

### 既定の規約

`implementation.docs` と `review.docs` は、設定ファイルに何を書いても次の規約を必ず含む。
設定に書いたものは、この後ろに足される（同じパスを書いても二重にはならない）。既定の規約を外す手段は無い。

| ファイル | 内容 | `implementation.docs` | `review.docs` |
|---|---|---|---|
| `.ai/_docs/coding.md` | コーディングガイドライン | ○ | ○ |
| `.ai/_docs/comment.md` | コメント記載ガイドライン | ○ | ○ |
| `.ai/_docs/error-handling.md` | エラーハンドリングガイドライン | ○ | ○ |
| `.ai/_docs/feature-test.md` | 機能テストガイドライン | ○ | ○ |
| `.ai/_docs/git-commit-comment.md` | コミットメッセージの書式 | ○ | — |

`config.mjs init` が作る設定ファイルでは、この2項目を空の配列にしてある。現場で足した規約だけが並ぶようにするため。

## パスの書き方と解決の起点

| 書き方 | 例 | 起点 |
|---|---|---|
| 相対パス（推奨） | `.ai/_docs/coding.md` | **リポジトリのルート**（`git rev-parse --show-toplevel`） |
| 絶対パス | `/home/me/notes/rule.md` | — |
| `~` 始まり | `~/notes/rule.md` | ホームディレクトリ |

起点を作業ディレクトリにしないのは、サブディレクトリから Claude Code を起動しても
同じファイルを指すようにするため。

- `.ai/_docs/` は `aidoc install` が作るシンボリックリンクで、実体は ai-doc の `plugins/core/_docs/`
- リポジトリ外の絶対パスを読むには、`.claude/settings.local.json` の
  `permissions.additionalDirectories` に許可が要る

## 読み方

1. ファイルが無ければ **止まる**（`show` が返す `initCommand` を提示する）
2. `docs` や `pullRequest.template` のパスが存在しなければ、**警告してスキップ**し処理を続ける。
   現場によって規約ファイルの有無が変わるため、ここで止めると使い物にならない。
   テンプレートが無い場合は既定のテンプレートに戻す
3. `"ask"` はその場でユーザーに確認する。非対話で回したい現場は `true` / `false` を書く
4. `skills` の名前は、SKILL.md 冒頭の呼び出し先の解決表と同じ規則で解決する
5. **`implementation.skills` に `core:commit` は書かない。**
   `commit` スキルはユーザーの承認を求めるが、実装エージェントはユーザーに質問できないため
   契約が矛盾する。コミットメッセージ規約は `implementation.docs` 経由で読ませる

## 設定に持たないもの

| 項目 | 理由 |
|---|---|
| テストの実行コマンド | 現場ごとに違うが、その場でユーザーに聞けば足りる。区切りのたびに確認してセッション内で使い回す |
| base ブランチ・ブランチ名の規則 | ブランチ準備スキルが既定ブランチを自動判定する。2つ目以降のタスクの base は「直前のタスクのブランチ」で一意に決まる |

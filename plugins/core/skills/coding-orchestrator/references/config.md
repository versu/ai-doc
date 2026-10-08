# 設定ファイル `.ai/_settings/coding-orchestrator/settings.json`

読み手はオーケストレーター。現場ごとの差異をここから受け取る。

## 置き場所

参画先リポジトリの `.ai/_settings/coding-orchestrator/settings.json`。
`.ai/` は `aidoc install` が `.git/info/exclude` に登録しているため、参画先を汚さない。

設定はスキルごとに `.ai/_settings/<スキル名>/` へ分けて置く。
Issue・PR の本文のテンプレートや追加の規約は、それぞれ Issue 作成スキル・PR 作成スキルの設定に書く
（`.ai/_settings/create-gh-issue/settings.json`、`.ai/_settings/create-gh-pr/settings.json`）。
スキルを単体で使ったときにも同じ設定が効くようにするため。

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
| `repos.<リポジトリ>.implementation.docs` | 文字列の配列 | パス | `[]` | 共通の docs に追加 | 複数リポジトリモードだけ。そのリポジトリを担当する実装エージェントに追加で読ませる規約 |
| `repos.<リポジトリ>.review.docs` | 文字列の配列 | パス | `[]` | 共通の docs に追加 | 同上。レビュアーに追加で読ませる規約 |

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
`config.mjs init` は、Issue・PR 作成スキルの設定の雛形も作る（既にあれば上書きしない）。

## 複数リポジトリモード

設定ファイルを置いたフォルダ（ハブ）に `*.code-workspace` があり、ハブ以外の git リポジトリが `folders` に並んでいるときは、
**複数リポジトリモード**になる。対象リポジトリの一覧は `.code-workspace` から読み、この設定ファイルには持たない。

- リポジトリ名は `folders[].name`、無ければフォルダ名。`#`・空白・パス区切り文字は使えない
- git リポジトリでないフォルダと、ハブと同じリポジトリのフォルダは対象にしない
- `repos` のキーはこのリポジトリ名に限る。`config.mjs init` は、対象リポジトリごとの空の枠を書く
- `repos.<リポジトリ>` の相対パスの起点は**そのリポジトリのルート**。共通の `implementation.docs`・`review.docs` の起点はハブのまま

`show` は `mode`（`single` / `multi`）、`hubRoot`（`.ai/` を置く場所）、`repos` を返す。
`repos.<リポジトリ>` には `path`（リポジトリのルート）と、共通の規約にリポジトリ別の規約を足した `implementation.docs`・`review.docs` が入る。
エージェントに渡す `requiredDocs` はここから取る。

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

1. 開始時に `config.mjs check` で検証し、問題があれば **止まる**（下の「検証」を参照）
2. 書かれたパス（既定の規約を含む）のファイルが無い場合も **止まる**。
   読ませるはずの規約が無いまま進むと、規約を守らない実装とレビューが通ってしまうため
3. `"ask"` はその場でユーザーに確認する。非対話で回したい現場は `true` / `false` を書く
4. `skills` の名前は、SKILL.md 冒頭の呼び出し先の解決表と同じ規則で解決する
5. **`implementation.skills` に `core:commit` は書かない。**
   `commit` スキルはユーザーの承認を求めるが、実装エージェントはユーザーに質問できないため
   契約が矛盾する。コミットメッセージ規約は `implementation.docs` 経由で読ませる

## 検証

```bash
node <このスキル>/scripts/config.mjs check
```

問題があれば終了コード1で、`{ ok, reason, configPath, errors }` を返す。
Issue・PR 作成スキルの設定（ファイルが無ければ既定で通る）も合わせて検証し、その問題も `errors` に並べる。
`reason` はオーケストレーター自身の設定の問題を優先し、呼び出し先の設定だけに問題があるときは `invalid-skill-settings` になる。
問題は最初の1件で止めず、すべて `errors` に並べる。
`show` はオーケストレーター自身の設定だけを同じ判定で返す。そのため `check` が通れば `show` の `ok` も `true` になる。
各設定ファイルの検査は下の表の順に段階を踏み、ある段階で問題があればそのファイルの検査はそこで止める（記法が誤っていると、パスが正しく読み取れないため）。
そのため、記法を直すと、次の段階のファイルの有無の問題が新たに出ることがある。

| 検査 | 不合格の例 | `reason` |
|---|---|---|
| 設定ファイルがある | — | `not-initialized` |
| JSON として読める | `{ broken` | `invalid-json` |
| `.code-workspace` が妥当 | 2つある、リポジトリ名が重複している、`folders` のフォルダが無い | `invalid-workspace` |
| ハブから対象リポジトリへのファイルアクセスが許可されている | リポジトリを足したのに `aidoc workspace sync` を実行していない | `workspace-not-synced` |
| 最上位と各セクションがオブジェクト | `[]`、`"review": []` | `invalid-value` |
| 未知のキーが無い | `implemntation`、`review.roundcap` | `invalid-value` |
| 値の型と範囲 | `createIssue: "yes"`、`roundCap: 0`、`skills: "x"` | `invalid-value` |
| `repos` のキーが `.code-workspace` のリポジトリ名 | `repos.mobile`（ワークスペースに無い） | `invalid-value` |
| 配列の要素が空でない文字列 | `docs: [1]`、`docs: [""]` | `invalid-value` |
| `implementation.skills` に `commit` が無い | `["core:commit"]` | `invalid-value` |
| 書かれたパスのファイルがある | `docs/ない.md`、`.ai/_docs/coding.md`（`aidoc install` 漏れ） | `missing-docs` |
| Issue・PR 作成スキルの設定が妥当 | `create-gh-pr` の `template` のファイルが無い | `invalid-skill-settings` |

既知のキーは [orchestration.default.json](orchestration.default.json) のキーから作る。
項目を増やすときは、そのファイルに既定値を足せば検証も追従する。

## 設定に持たないもの

| 項目 | 理由 |
|---|---|
| テストの実行コマンド | 現場ごとに違うが、その場でユーザーに聞けば足りる。区切りのたびに確認してセッション内で使い回す |
| base ブランチ・ブランチ名の規則 | ブランチ準備スキルが既定ブランチを自動判定する。2つ目以降のタスクの base は「直前のタスクのブランチ」で一意に決まる |

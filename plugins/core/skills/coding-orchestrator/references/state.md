# 状態ファイル `progress.json`

読み手はオーケストレーター。タスクディレクトリ `.ai/_tasks/#<Issue 番号> <Issue タイトル>/progress.json` に置く
（合意して Issue を起票するまでは、番号なしの `.ai/_tasks/<タイトル>/`。`assign-issues` で番号を付ける）。
フォルダ名に空白と `#` が入るので、**パスを渡すときは必ず引用符で囲む**。

**このファイルを手で書き換えない。** 読み書きは `scripts/state.mjs` 越しに行う。
追記と `status` の更新を必ずセットで行うためで、片方だけ書かれると再開が壊れる。

## 構造

```jsonc
{
  "status":    { /* histories から算出した現在の姿。再開はここだけを読む */ },
  "repo":      "api",  // 複数リポジトリモードだけ。親（分解しなければそのタスク）のリポジトリ
  "tasks":     [ /* タスクの一覧。準備フェーズの合意で確定する定義 */ ],
  "histories": [ /* 起きたことを時系列に追記する */ ]
}
```

| フィールド | 性質 |
|---|---|
| `histories` | **唯一の真実**。追記のみで、過去の要素を書き換えない |
| `status` | `histories` から算出したスナップショット。**セッションの再開はここだけ読めばよい** |
| `tasks` | 準備フェーズで確定する定義。実行中に増減させない |
| `repo` | 複数リポジトリモードだけ持つ。親のリポジトリ（`.code-workspace` から得たリポジトリ名）。`init --repo` で記録する |

`status` は算出できる値をあえて二重に持っている。履歴が伸びても再開のコストを
一定に保つためで、食い違ったときは `histories` が正（`recompute` で作り直す）。

タスク名はディレクトリ名がそのまま使えるので持たない。スキーマのバージョンも持たない。

## `status`

| 項目 | 型 | 意味 |
|---|---|---|
| `phase` | 文字列 | `"preparation"`（合意前）/ `"execution"`（実装・レビュー中）/ `"pr-created"`（全タスクが終わり、PR のレビュー対応と完了の指示を待っている）/ `"done"`（ユーザーの指示で完了にした。`completion` がある） |
| `currentTask` | 文字列/null | いま進めているタスクの `id`。分解していない、または進行中のタスクが無ければ `null` |
| `updatedAt` | 文字列 | 最後に更新した日時（ISO 8601） |
| `taskStates` | オブジェクト | タスクの `id` をキーにした進み具合。分解していなければ `main` の1件 |
| `round` | オブジェクト/null | 最後に扱ったタスクのレビュー状況。どのタスクにも着手していなければ `null` |
| `openQuestions` | 配列 | 未解決のものだけ。`{ question, task, assumption }` |
| `deferred` | 配列 | 先送りの一覧。`{ task, summary, reason }`（`reason` は `follow-up` / `stop`） |

### `taskStates[id]`

| 項目 | 意味 |
|---|---|
| `state` | `pending`（未着手） / `running`（実装またはレビュー中） / `done`（ゲート通過） / `blocked`（Scope lock を越える判断が必要） / `stopped`（レビュー上限で打ち切り） |
| `branch` | 作業ブランチ名 |
| `pullRequest` | PR 番号 |
| `summary` | 1行サマリ。完了報告と PR 本文に使う |
| `agentId` | このタスクを実装したエージェントの ID。**修正や PR 指摘対応で再開するときに使う** |

### `round`

| 項目 | 意味 |
|---|---|
| `n` | 何周目か。`review.roundCap` と突き合わせて打ち切りを判断する |
| `base` | 次のレビューの範囲の起点 SHA |
| `head` | 直近のレビューの終点 SHA。まだレビューしていなければ `null` |

## `tasks[]`

準備フェーズの合意で確定する定義。**変化する値をここに入れない**（それは `taskStates`）。

| 項目 | 意味 |
|---|---|
| `id` | タスク識別子。**サブタスクのフォルダ名と同じ文字列**にする（`#43 キャンセル済みを金額から除く`）。spec のパスはここから組み立てる。実行順序はこの配列の並びで決まるので、番号が飛んでいてもよい |
| `title` | タスクの名前 |
| `issue` | 対応する Issue の番号。起票しなかったら `null` |
| `repo` | 複数リポジトリモードだけ必須。このタスクを作業するリポジトリ。親と違うリポジトリでよい |

- **タスク分解しなかった場合は空配列**にし、履歴の `task` は `null` にする
- 親 Issue の番号はここに入らない（タスクではないため）。`agreement` の履歴に残る

## `histories[]`

| 項目 | 意味 |
|---|---|
| `at` | 日時（ISO 8601）。省略すると現在時刻が入る |
| `kind` | 何が起きたか |
| `task` | どのタスクの出来事か（`tasks[].id`）。分解していない場合や準備フェーズは `null` |
| `data` | `kind` ごとの中身 |

| `kind` | いつ | `data` |
|---|---|---|
| `agreement` | 準備フェーズの合意が取れたとき | `summary`、`parentIssue`（無ければ `null`） |
| `branch` | ブランチを準備したとき | `base`、`baseSha`、`branch` |
| `implementation` | 実装エージェントが結果を返したとき | `agentId`、`resumed`、`result`（戻り値 JSON そのまま） |
| `review` | レビュアーの結果を裁定したとき | `mode`、`base`、`head`、`result`、`dispositions`、`unresolvedBlockers` |
| `verification` | 区切りでテストを流したとき | `command`、`result`（`pass` / `fail`） |
| `decision` | ユーザーが判断したとき | `question`、`answer` |
| `pull-request` | PR を作ったとき | `number`、`base` |
| `pr-feedback` | PR の指摘への対応を始めるとき | `pullRequest`、`accepted`、`rejected` |
| `push` | 既存の PR へ push したとき | `pullRequest`、`head` |
| `completion` | ユーザーの指示でタスクを完了にしたとき（`complete` が追記する） | `forced`（`pr-created` になる前に完了にしたか） |

### `review` の `dispositions` と `unresolvedBlockers`

**別のものなので混同しない。**

- `dispositions` は**決着した**指摘の処置。`fixed:` / `deferred:` / `non-actionable:` /
  `follow-up:` / `stop:` のいずれかで始め、続けて対象を1行で書く。
  次のラウンドのレビュアーに渡して蒸し返しを防ぐ
- `unresolvedBlockers` は**このラウンドで直すと決めたブロッカーの件数**。
  裁定の結果であり、レビュアーの指摘件数ではない。**0 ならゲート通過**

```
fixed: 無効化済み対象にも作成できていた (commit def5678)
non-actionable: 変数名は好みの問題
deferred: エラーメッセージの多言語化はスコープ外
```

## `scripts/state.mjs` の使い方

| サブコマンド | すること |
|---|---|
| `list [--repo <path>]` | **進行中のタスクを一覧する。** `.ai/_tasks/` を走査し、`_done/`・`_drafts/` と `progress.json` の無いフォルダを除き、新しく触った順に並べる |
| `init --dir <タスクディレクトリ> [--tasks <tasks.json>] [--repo <リポジトリ>]` | `progress.json` を作る。既にあれば失敗する。複数リポジトリモードでは `--repo` と `tasks[].repo` が必須で、ワークスペースに無い名前は弾く。単一リポジトリモードで指定しても弾く |
| `append --dir <dir>`（標準入力に履歴1件の JSON） | 追記して `status` を更新する。契約に合わなければ**書き込まずに終了コード1** |
| `assign-issues --dir <dir>`（標準入力に `{ "parent": <番号>, "tasks": { "<id>": <番号> } }`） | **下書きのフォルダに Issue 番号を付ける。** 親とサブタスクのフォルダを `#<番号> <元の名前>` に改名し、`tasks[].id`・`tasks[].issue` を書き換える。`parent` と `tasks` はどちらも省略できる。`phase` が `preparation` でない、改名先に同名のフォルダがある、などのときは**何も変えずに終了コード1** |
| `recompute --dir <dir>` | `histories` から `status` を作り直す |
| `show --dir <dir>` | `status` と `tasks` に、作業するリポジトリ（`repo`・`repoPath`、各タスクの `repoPath`）を添えて出力する。**再開時はこれだけ読む** |
| `branch-base --dir <dir> [--task <id>]` | 積み上げの base を返す。**同じリポジトリの直前のタスク**のブランチで、無ければ `null`（既定ブランチから切る） |
| `review-base --dir <dir> --task <id> [--repo <path>]` | 次のレビュー範囲の起点を git で検証して返す。`--repo` が無ければタスクのリポジトリで git を実行する |
| `complete --dir <dir> [--force]` | **タスクを完了にする。** `completion` を追記し、`.ai/_tasks/_done/` へ移す。`phase` が `pr-created` でなければ `--force` が要る。移動先に同名のフォルダがある、`.ai/_tasks/` の直下でない、などのときは**何も変えずに終了コード1** |

### `list` が返すもの

```jsonc
{
  "tasksDir": "/abs/.ai/_tasks",
  "tasks": [
    { "name": "#42 受注サマリのキャンセル除外",
      "dir": "/abs/.ai/_tasks/#42 受注サマリのキャンセル除外",
      "phase": "execution",
      "currentTask": "#43 キャンセル済みを金額から除く",
      "summary": "キャンセル済みを金額から除いた",
      "updatedAt": "2026-09-22T10:00:00+09:00" }
  ],
  "ignored": ["メモ置き場"]
}
```

`phase` と `summary` を添えるのは、**どれが何だったかを思い出せないと選べない**ため。

`.ai/_tasks/` 直下のものは次のように扱う。

| 直下のもの | 扱い |
|---|---|
| ファイル、`_done/`、`_drafts/`（下書き置き場。`aidoc orchestrator init` が作る） | 返さない |
| `progress.json` が無いフォルダ | `tasks` に入れず、名前だけを `ignored` に入れる。手で作ったメモ置き場など、オーケストレーターと無関係なものなので候補にしない |
| `progress.json` が壊れている（JSON として読めない、`status` が無い）フォルダ | `note` を付けて `tasks` に入れる。オーケストレーターが作ったファイルが壊れている可能性が高く、黙って落とすと「あるはずのタスクが出てこない」になり、原因を追えなくなる |
| 正しい `progress.json` があるフォルダ | `tasks` に入れる |

`ignored` は候補として提示しない。タスクが見つからないときの原因調査にだけ使う。

### `show` が返すもの

```jsonc
{ "status": { ... },
  "repo": "api",                       // 単一リポジトリモードでは null
  "repoPath": "/abs/api",              // 単一リポジトリモードではリポジトリのルート
  "tasks": [{ "id": "web#12 ...", "title": "...", "issue": 12, "repo": "web", "repoPath": "/abs/web" }] }
```

エージェントやスキルに渡す作業場所は、ここの `repoPath` をそのまま使う。

### `branch-base` が返すもの

```jsonc
{ "task": "api#44 ...", "repo": "api", "repoPath": "/abs/api",
  "previousTask": "api#43 ...",       // 同じリポジトリの直前のタスク。無ければ null
  "base": "feature/#43-..." }         // null なら既定ブランチから切る
```

直前のタスクにまだブランチが無ければ、終了コード1で止まる（順番を飛ばして進めている）。

### `review-base` が返すもの

```jsonc
{ "task": "#43 ...", "base": "<sha>", "head": "<sha>", "mode": "full|regression",
  "clean": true, "previousHead": "<sha>|null", "reason": "..." }
```

`mode` が `regression` になるのは、直前のラウンドの head が現 HEAD の**厳密な祖先**で、
かつ**範囲が空でない**ときだけ。どちらかを満たさなければタスクの起点に戻して `full` を返す。

**差分が空のときを「指摘ゼロ＝合格」と読まない。** 実装が何も変えなかったということなので、
レビューの前に何が起きたかを確認する。`reason` にその旨が入る。

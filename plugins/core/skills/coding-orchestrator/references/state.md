# 状態ファイル `progress.json`

読み手はオーケストレーター。タスクディレクトリ `.ai/_tasks/#<Issue 番号> <Issue タイトル>/progress.json` に置く。
フォルダ名に空白と `#` が入るので、**パスを渡すときは必ず引用符で囲む**。

**このファイルを手で書き換えない。** 読み書きは `scripts/state.mjs` 越しに行う。
追記と `status` の更新を必ずセットで行うためで、片方だけ書かれると再開が壊れる。

## 構造

```jsonc
{
  "status":    { /* histories から算出した現在の姿。再開はここだけを読む */ },
  "tasks":     [ /* タスクの一覧。準備フェーズの合意で確定する定義 */ ],
  "histories": [ /* 起きたことを時系列に追記する */ ]
}
```

| フィールド | 性質 |
|---|---|
| `histories` | **唯一の真実**。追記のみで、過去の要素を書き換えない |
| `status` | `histories` から算出したスナップショット。**セッションの再開はここだけ読めばよい** |
| `tasks` | 準備フェーズで確定する定義。実行中に増減させない |

`status` は算出できる値をあえて二重に持っている。履歴が伸びても再開のコストを
一定に保つためで、食い違ったときは `histories` が正（`recompute` で作り直す）。

タスク名はディレクトリ名がそのまま使えるので持たない。スキーマのバージョンも持たない。

## `status`

| 項目 | 型 | 意味 |
|---|---|---|
| `phase` | 文字列 | `"preparation"` / `"execution"` / `"done"` |
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
| `list [--repo <path>]` | **進行中のタスクを一覧する。** `.ai/_tasks/` を走査し、`_done/` を除き、新しく触った順に並べる |
| `init --dir <タスクディレクトリ> [--tasks <tasks.json>]` | `progress.json` を作る。既にあれば失敗する |
| `append --dir <dir>`（標準入力に履歴1件の JSON） | 追記して `status` を更新する。契約に合わなければ**書き込まずに終了コード1** |
| `recompute --dir <dir>` | `histories` から `status` を作り直す |
| `show --dir <dir>` | `status` と `tasks` を出力する。**再開時はこれだけ読む** |
| `review-base --dir <dir> --task <id> [--repo <path>]` | 次のレビュー範囲の起点を git で検証して返す |

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
  ]
}
```

`phase` と `summary` を添えるのは、**どれが何だったかを思い出せないと選べない**ため。

`progress.json` が無い、または壊れているディレクトリも `note` を付けて一覧に出す。
黙って落とすと「あるはずのタスクが出てこない」になり、原因を追えなくなる。

### `review-base` が返すもの

```jsonc
{ "task": "#43 ...", "base": "<sha>", "head": "<sha>", "mode": "full|regression",
  "clean": true, "previousHead": "<sha>|null", "reason": "..." }
```

`mode` が `regression` になるのは、直前のラウンドの head が現 HEAD の**厳密な祖先**で、
かつ**範囲が空でない**ときだけ。どちらかを満たさなければタスクの起点に戻して `full` を返す。

**差分が空のときを「指摘ゼロ＝合格」と読まない。** 実装が何も変えなかったということなので、
レビューの前に何が起きたかを確認する。`reason` にその旨が入る。

# 実行フェーズの手順

読み手はオーケストレーター。

タスクごとに「ブランチ準備 → 実装 → レビューのラウンド → 区切りの確認 → PR 作成」を
**直列に**繰り返す。分解しなかった場合はこれを1周するだけ。
分解した場合、PR は既定で全タスクが終わってからまとめて作る（5 と「全タスク完了後」）。

直列にするのは、同じリポジトリでは worktree を共有していて、かつブランチを積み上げるため。並列化しない。

**作業するリポジトリは `state.mjs show` の `repoPath`（サブタスクは `tasks[].repoPath`）。**
単一リポジトリモードではカレントのリポジトリ、複数リポジトリモードではタスクごとに違う。自分でパスを組み立てない。

## 1. ブランチの準備

まず base を決める。

```bash
node <このスキル>/scripts/state.mjs branch-base --dir ".ai/_tasks/#42 ..." --task "#43 ..."
```

返ってきた `base` を推奨案にしてブランチ準備スキルを呼ぶ。作業リポジトリとして `repoPath` も渡す。

- `base` が `null`: リポジトリの既定ブランチ（スキルが候補を出し、ユーザーに確認する）。1つ目のタスクと、
  複数リポジトリモードでそのリポジトリの最初のタスクがこれにあたる
- `base` がある: **同じリポジトリの直前のタスクのブランチ**（積み上げ。`previousTask` がそのタスク）。
  別のリポジトリのブランチからは切れないので、間に別リポジトリのタスクが挟まっていても飛ばして探す

タスク間には依存があるのが普通なので、積み上げを既定にする。
依存が無いことが明らかで、ユーザーが望む場合だけ既定ブランチから切ってよい。

base と作業ブランチ名は、スキルが `AskUserQuestion` でユーザーに確認したうえで決まる。
こちらは推奨案（base と、`feature/#<Issue 番号>-<作業名>` の形の名前）を渡すところまで。

結果を履歴に追記する。

```bash
echo '{"kind":"branch","task":"#43 ...","data":{"base":"main","baseSha":"<sha>","branch":"feature/#43-cancel-exclude"}}' \
  | node <このスキル>/scripts/state.mjs append --dir ".ai/_tasks/#42 ..."
```

タスクフォルダのパスは空白と `#` を含むので、**必ず引用符で囲む**。

## 2. 実装

実装エージェントを新規に起動する（入力は [contracts.md](contracts.md)）。`repoPath` を必ず渡す。
複数リポジトリモードでは、`requiredDocs` を起動時点の設定の `repos.<リポジトリ>.implementation.docs` から取る。
**返ってきたエージェントの ID を必ず履歴に残す。** あとで再開するのに使う。

戻り値を検証して追記する。`append` が契約違反を弾いたら、**1回だけ再実行**し、
2回失敗したらユーザーに報告して止まる。壊れた戻り値を推測で補わない。

- `status: "blocked"` が返ったら、Scope lock を越える判断が要るということ。
  `AskUserQuestion` で「Scope lock を広げる」／「別タスクに切り出す」／「今回はやらない」を聞く
- `openQuestions` が返ったら、質問ごとに `AskUserQuestion` を出す。
  **エージェントが置いた仮の判断を選択肢の先頭に並べる**（そのままでよければ選ぶだけで済む）。
  回答が仮置きと違えば spec を更新し（詳細仕様書に関わる内容ならそちらも合わせて直す）、
  `decision` の履歴を追記してから実装を続けさせる

## 3. レビューのラウンド

### 範囲を決める

```bash
node <このスキル>/scripts/state.mjs review-base --dir ".ai/_tasks/#42 ..." --task "#43 ..."
```

`review-base` はタスクのリポジトリで git を実行する（`--repo` を渡さなくてよい）。
返ってきた `base` / `head` / `mode` を、`repoPath` と一緒にそのままレビュアーに渡す。**範囲を自分で決め直さない。**
複数リポジトリモードでは、`requiredDocs` を `repos.<リポジトリ>.review.docs` から取る。

- `clean` が `false` なら、worktree が汚れていてレビュー対象を固定できない。先に片付ける
- `reason` が「差分がない」と言っていたら、実装が何も変えなかったということ。
  **「指摘ゼロ＝合格」と読まずに**、何が起きたかを確認する

### 起動する

レビュアーは**毎ラウンド新規に起動する**（再開しない）。`dispositions` はこれまでの全ラウンド分を
束ねて渡す。初回は `["None yet"]`。

### 裁定する

[contracts.md](contracts.md) の「裁定」に従って分類を確定する。
レビュアーの `classification` は提案であって決定ではない。

**ゲート通過の条件は「未解決の blocker が 0 件」。「指摘ゼロ」ではない。**

裁定の結果を追記する。`unresolvedBlockers` が 0 ならそのタスクは `done` になる。

```bash
cat <<'JSON' | node <このスキル>/scripts/state.mjs append --dir ".ai/_tasks/#42 ..."
{"kind":"review","task":"#43 ...","data":{"mode":"full","base":"<sha>","head":"<sha>",
 "result":{...レビュアーの戻り値...},
 "dispositions":["fixed: ...","non-actionable: ..."],
 "unresolvedBlockers":0}}
JSON
```

### ブロッカーが残っていたら

`status.round.n` と `review.roundCap` を比べる。

- **上限未満**: 実装エージェントを `SendMessage` で**再開**し、ブロッカーだけを渡して直させる。
  再開できなければ、履歴に残した前回の戻り値と spec を添えて新規起動する
- **上限に達した**: `AskUserQuestion` で「打ち切って次へ（推奨）」／「もう1周だけ回す」を聞く。
  打ち切るなら残ったブロッカーを `stop:` の処置として記録し、次のタスクへ進む
  （1タスクの不調で全部を止めない）

3ラウンド回しても収束しない領域は、それ以上回しても収束しない。
Follow-up は毎ラウンド `follow-up:` として記録し、**その場では直さない**。
良くなる程度の提案に付き合い続けると、レビューが終わらなくなる。

## 4. 区切りの確認

「区切り」= タスクが完了し、かつ spec 上の機能単位が閉じたとき。判断はオーケストレーター。

- テストの実行コマンドは**その場で `AskUserQuestion` で聞き**、以後そのセッション内で使い回す。
  リポジトリから見当がつく候補（`npm test` など）を選択肢に並べる
- 画面（UI）を作ったタスクの直後は、**`AskUserQuestion` で目視確認を依頼する**。
  選択肢は「問題なかった」／「問題があった」
- 結果を `verification` の履歴に残す

## 5. このタスクの Pull Request

設定 `orchestrator.createPullRequest` に従う。`false` なら何もせずに次のタスクへ進む。

### タスクを分けていて、最後のタスクでないとき

**PR は全タスクが終わってから作るのを既定にする。** タスクはレビュアーが確認しやすい単位で分けているが、
PR を出すのは、ローカルで全タスクを通して動作を確かめてからにしたい（API と画面に分けたなら、両方がそろってから）。

| 設定 | すること |
|---|---|
| `"ask"` | `AskUserQuestion` で「次のタスクに進む（推奨）」／「このタスクの PR を今作る」を聞く |
| `true` | 聞かずに後回しにする |

後回しにしたら `pull-request-skip` を追記して、次のタスクの 1 へ進む。
**追記を省かない。** 省くと、中断したあとの再開で後回しにした PR が作られないまま `pr-created` になる。

```bash
echo '{"kind":"pull-request-skip","task":"#43 ...","data":{"reason":"deferred"}}' \
  | node <このスキル>/scripts/state.mjs append --dir ".ai/_tasks/#42 ..."
```

「このタスクの PR を今作る」が選ばれたら、下の「PR を作る」に進む。

### 分けていない、または最後のタスクのとき

`"ask"` なら `AskUserQuestion` で「作る」／「作らない」を聞く。`true` なら聞かずに作る。

- 後回しにした PR が残っている（`status.pendingPullRequests` が空でない）ときは、聞かずにこのタスクにも
  `pull-request-skip`（`reason` は `deferred`）を追記して「全タスク完了後」へ進む。
  このタスクの PR も、全体の確認のあとに積み上げの順で作る（`createPullRequest` が `false` のときは、そもそも後回しが無い）
- 「作らない」が選ばれたら `pull-request-skip`（`reason` は `declined`）を追記する

### PR を作る

PR 作成スキルを呼ぶ。作業リポジトリとして `repoPath` を、本文の書き出し先としてタスクフォルダの**絶対パス**を渡す。
**宛先は base ブランチ**（積み上げなら同じリポジトリの直前のタスクのブランチ）。
本文のテンプレートと追加の規約は渡さない。PR 作成スキルが自分の設定（`.ai/_settings/create-gh-pr/settings.json`）から読む。

作成したら `pull-request` の履歴を追記する。

## 全タスク完了後

### 後回しにした PR を作る

`state.mjs show` の `status.pendingPullRequests` が空なら、この節は飛ばす。空でなければ次を順に行う。

1. **全体の動作確認を頼む。** `AskUserQuestion` で、全タスクを通した動作確認を依頼する。
   選択肢は「問題なかった」／「問題があった」。テストも流し、結果を `verification`（`task` は `null`）に残す
2. 「問題があった」なら、どのタスクで直すかを `AskUserQuestion` で聞き、そのタスクの実装エージェントを `SendMessage` で再開する。
   直したら、そのタスクの 3（レビューのラウンド）から回し直す。積み上げの上にあるタスクのブランチは、直したブランチの上に載せ直す。
   Scope lock を越える修正が要るなら、実装の `blocked` と同じく判断を仰ぐ
3. `pendingPullRequests` の並び（積み上げの順）に、1つずつ PR を作る。手順は 5 の「PR を作る」と同じ。
   `"ask"` でも、タスクごとには聞き直さない。1 の前に「後回しにした PR をまとめて作る」ことを一度だけ確認する。
   作らないと決めたタスクには `pull-request-skip`（`reason` は `declined`）を追記する

`pendingPullRequests` が空になると、`phase` が `pr-created` になる。

### 締める

1. `status.deferred` の一覧を提示する。先送りが静かに忘れられるのを防ぐ
2. 作成した PR の一覧と、**マージは古い順に行う**ことを伝える（積み上げのため）。
   複数リポジトリモードでは、PR をリポジトリごとに分けて示し、リポジトリ間の依存（API を先にマージする、など）も伝える
3. タスクディレクトリは移さない。`phase` は `pr-created` になり、`list` の候補に残る

PR にレビューコメントが付いたら [pr-feedback.md](pr-feedback.md) の流れで対応する。
`_done/` へ移すのは、ユーザーが完了を指示したとき（SKILL.md の STEP 7）だけ。

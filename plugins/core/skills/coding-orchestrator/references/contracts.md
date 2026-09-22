# エージェントの入出力契約

読み手はオーケストレーター。エージェント側の契約は各エージェント定義にも書いてある。

## 共通の方針 — 算出できる値を載せない

入出力には、他の項目や git から算出できる値を載せない。二重に持つと、食い違ったときに
どちらが正しいか分からなくなる。

| 載せないもの | どこから分かるか |
|---|---|
| 入力の echo（タスク ID、mode など） | オーケストレーターが自分で渡した値 |
| 作ったコミットの SHA 一覧 | `git log <baseSha>..HEAD` |
| 実装後の HEAD | `git rev-parse HEAD` |
| 触ったファイルの一覧 | `git diff --name-only <baseSha>..HEAD` |
| 指摘の件数 | 指摘の配列を数える |

（`status` だけは例外で、再開を速くするためにあえてキャッシュしている。[state.md](state.md) 参照）

## 実装エージェント

### 1回目の起動で渡すもの

| 項目 | 意味 |
|---|---|
| `specPath` | 読むべき spec.md のパス。Scope lock がこのエージェントへの契約。タスク名もここから分かる |
| `requiredDocs` | 着手前に必ず読むドキュメントのパス（設定 `implementation.docs` を解決したもの） |
| `availableSkills` | 使ってよいスキルの解決済み名。空なら何も使わない |

### 2回目以降（`SendMessage` での再開）で渡すもの

| 項目 | 意味 |
|---|---|
| `blockers` | 直すべきブロッカーの一覧（レビュアーの `findings` の形）。**ここに挙がったものだけを直す** |
| `resolvedQuestions` | 前回返した質問へのユーザーの回答（`question` と `answer` の組） |

spec も規約も1回目に読んでいるので渡し直さない。
`mode` のような「実装か修正か」の印も渡さない。**`blockers` が渡されたラウンドが修正ラウンド**、
という規則にすれば同じことを2か所に書かずに済む。

**再開できなかったとき**は、1回目の入力に `blockers` と、履歴に残した前回の戻り値を添えて
新規に起動する。再開できることを前提にした手順にしない。

### 返ってくるもの（毎回同じ形）

```jsonc
{
  "status": "completed",            // "completed" | "blocked"
  "summary": "重複チェック付きの登録 API を追加",
  "acceptanceCriteria": [
    { "text": "設定で無効にしている対象には作成できない", "met": true, "evidence": "RegisterService.cs:88 で判定。テスト追加" }
  ],
  "verification": [{ "command": "npm test", "result": "pass" }],
  "openQuestions": [
    { "question": "重複判定のキーはメールアドレス単独でよいか",
      "why": "spec に明記がなく、既存テーブルに複合一意制約がある",
      "assumption": "メールアドレス単独で判定した",
      "impact": "違う場合は RegisterService の判定と移行スクリプトをやり直す" }
  ]
}
```

- `status: "blocked"` は **Scope lock を越えないと進めない**とき。コミットが無くてよい
- `acceptanceCriteria` は spec の受け入れ条件と1対1。
  **`met: false` が1件でもあればゲートは通らない**。レビュー以前の問題として扱う

## レビュアーエージェント

**毎ラウンド新規に起動する。再開しない。**
再開すると前ラウンドで見た変更全体を覚えており、「見せる範囲を絞る」設計が無意味になる。

### 渡すもの

| 項目 | 意味 |
|---|---|
| `specPath` | Scope lock を読ませる。受け入れ条件がレビューの基準になる |
| `base` / `head` | レビュー範囲の起点・終点の SHA。`state.mjs review-base` が返した値をそのまま渡す |
| `mode` | `"full"` / `"regression"`。算出できる値だが、**問いそのものが変わる**ので明示的に渡す |
| `requiredDocs` | レビュー前に必ず読むドキュメント（設定 `review.docs` を解決したもの） |
| `availableSkills` | 使ってよいスキルの解決済み名 |
| `dispositions` | これまでの全ラウンドの処置。初回は `["None yet"]` |

### 返ってくるもの

```jsonc
{
  "status": "reviewed",             // "reviewed" | "aborted"（HEAD が期待値と違うなど）
  "readDocs": [".ai/_docs/coding.md"],
  "readDocsReason": "変更が C# のみのため php-coding.md は読んでいない",
  "findings": [
    { "classification": "blocker",
      "title": "無効化済みの対象にも作成できる",
      "location": "src/RegisterService.cs:88",
      "failureScenario": "設定で無効にした対象 ID を渡すと検証を通過してレコードが作成され、受け入れ条件1が満たされない",
      "evidence": "88行目の分岐が enabled を参照していない",
      "suggestion": "作成前に settings.enabled を確認して弾く" }
  ]
}
```

`status` は**合否ではない**。レビューが成立したかどうかだけを表す。

## 裁定 — オーケストレーターだけが行う

レビュアーの `classification` は**提案**であって決定ではない。次を確認して分類を確定する。

1. `blocker` について、`failureScenario` が**具体的な入力／状態と、そのとき壊れるもの**を
   名指ししているか → できていなければ **follow-up か non-actionable に降格する**
2. `dispositions` に既出の指摘の蒸し返しでないか → 蒸し返しなら non-actionable
3. Scope lock の「やらないこと」に該当しないか → 該当するなら non-actionable
4. 受け入れ条件の未達（`acceptanceCriteria[].met` が `false`）は、レビュアーが挙げていなくても
   **blocker として扱う**

**ゲート通過の条件は「未解決の blocker が 0 件」。「指摘ゼロ」ではない。**

裁定の結果を `review` の履歴に書く（`dispositions` と `unresolvedBlockers`）。

## 戻り値が契約に合わないとき

`state.mjs append` が形を検証して弾く。弾かれたら **1回だけ再実行**し、
2回失敗したらユーザーに報告して止まる。壊れた戻り値を推測で補わない。

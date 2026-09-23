---
name: prepare-branch
description: 作業用のブランチを安全に切るスキル。base ブランチを確定して最新化し、作業ブランチを作って切り替える。「ブランチを切って」「作業ブランチを用意して」「main を最新にしてからブランチを作って」等のときに使用する。積み上げ（stacked PR）のために、直前の作業ブランチを base に指定することもできる。
allowed-tools:
  - AskUserQuestion
  - Bash(git status:*)
  - Bash(git fetch:*)
  - Bash(git pull:*)
  - Bash(git switch:*)
  - Bash(git branch:*)
  - Bash(git rev-parse:*)
  - Bash(git symbolic-ref:*)
---

# ブランチ準備

実装を始める前に、**どこから分岐したかを固定する**ためのスキル。
ここが曖昧なままだと、あとでレビュー範囲も PR の差分も決められなくなる。

**base と作業ブランチ名は、どちらも `AskUserQuestion` で確かめてから決める。**
呼び出し側から指定があっても省略しない。分岐元と枝の名前はあとから直すと
PR も履歴も作り直しになるので、ここだけは一度立ち止まるほうが安い。
推奨案は選択肢の先頭に置き、ラベルに「（推奨）」を付ける。

## 渡されるもの

| 項目 | 使い方 |
|---|---|
| base ブランチ名 | 推奨案として使う |
| 作業ブランチ名 | 同上 |
| Issue 番号 | 作業ブランチ名の候補を組み立てるのに使う |

## 手順

**下の「停止条件」に当たったら、何もせずに理由を報告して止まる。**

### 1. 未コミットの変更が無いことを確認する

```bash
git status --porcelain
```

出力があればコミットか stash を促す。

### 2. base ブランチを決める

候補を集め、`AskUserQuestion` で選んでもらう。判定できたときも省略しない。

```bash
git symbolic-ref --short refs/remotes/origin/HEAD   # 既定ブランチ。例: origin/main
git branch --format='%(refname:short)'              # ローカルのブランチ一覧
```

- 指定があればそれを、無ければ既定ブランチを先頭に置く
- 積み上げ（stacked）で作業するなら、直前の作業ブランチも候補に並べる
- 既定ブランチを判定できなかったら、その旨を選択肢の説明に書く

推測で `main` や `master` を使わない。現場によって既定ブランチの名前は違う。

### 3. base を最新化する

```bash
git switch <base>
git rev-parse --abbrev-ref <base>@{upstream}   # 上流が無ければ失敗する
git fetch origin && git pull --ff-only         # 上流があるときだけ実行する
```

積み上げでは base が「直前のタスクのローカルブランチ」になることがある。
上流が無いので最新化しない。
`--ff-only` にするのは、意図しないマージコミットを作らないため。

### 4. 作業ブランチ名を決める

`AskUserQuestion` で確認する。推奨する形は次のとおり。

```
feature/#<Issue 番号>-<作業名>      例: feature/#42-cancel-exclude
feature/<作業名>                    Issue が無い場合
```

Issue 番号を入れておくと、ブランチだけを見て何の作業か追える。
`<作業名>` は英小文字とハイフンで短くまとめる。

### 5. 作業ブランチを作る

```bash
git rev-parse HEAD                    # base の SHA を控える
git switch -c <作業ブランチ名>
```

## 停止条件

| 条件 | 理由 |
|---|---|
| 未コミットの変更がある | 別の作業を巻き込むため |
| base ブランチが存在しない | 取り違えたまま進むため |
| 既定ブランチを判定できず、指定も無い | 推測で決めると分岐元がずれるため |
| `git pull --ff-only` が早送りできない | base が分岐している。人が判断すべき状況のため |
| 同名の作業ブランチが既にある | 既存の作業を壊すため |

## 返すもの

- base ブランチ名
- **base の SHA**（レビュー範囲の起点になるので必ず返す）
- 作成した作業ブランチ名

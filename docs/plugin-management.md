# プラグイン管理ガイドライン

本リポジトリで管理するプラグインの定義方針をまとめる。
自作・外部を問わず、プラグインは `.claude-plugin/marketplace.json` にまとめて記載する。

## 記載項目

各プラグインエントリには、**次の項目だけを記載する**。
任意項目（`version`、`homepage`、`repository`、`license`、`keywords`、`strict`、`displayName` など）は設定しない。

| 項目 | 内容 |
|---|---|
| `name` | プラグイン識別子（ケバブケース）。呼び出し名の接頭辞になる（`core` → `/core:commit`） |
| `description` | 何をするプラグインか |
| `author.name` | 作成者 |
| `category` | `private`（自作）または `external`（他者が公開しているもの） |
| `source` | プラグインの実体の場所 |

`source` は Claude Code が必須とするため、方針の対象外として必ず記載する。

### 自作プラグイン（`private`）

```jsonc
{
  "name": "core",
  "description": "コミット規約・コーディング規約などのガイドと、それに沿って動くスキル・エージェント",
  "author": { "name": "versu" },
  "category": "private",
  "source": "./plugins/core"
}
```

### 外部プラグイン（`external`）

他者が公開しているプラグインも、同じカタログで扱う。公開元のリポジトリを `source` に指定し、リポジトリの一部ディレクトリにプラグインがある場合は `git-subdir` を使う。

```jsonc
{
  "name": "example-plugin",
  "description": "外部プラグインの記載例",
  "author": { "name": "Example" },
  "category": "external",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/example/plugins.git",
    "path": "plugins/example-plugin"
  }
}
```

**入手経路は ai-doc に一本化する。** 公開元のマーケットプレイスからも同じプラグインを導入できるが、両方から入れると同じスキルが二重に読み込まれるため、ai-doc 経由（`example-plugin@ai-doc`）だけを使う。

現時点で登録している外部プラグインはない（Claude Code に同梱されているものは登録不要）。

## バージョンと更新

`version` を書かないため、git ソースのプラグインは**公開元の既定ブランチの最新コミットを追う**（バージョンはコミット SHA になる）。特定のバージョンに固定したい場合だけ、`source` に `ref` か `sha` を足す。

更新は `aidoc update` で行う。内部では次を実行する。

1. `claude plugin marketplace update ai-doc` … カタログを読み直す
2. `claude plugin update <プラグイン名>@ai-doc` … 公開元の新しいコミットを取得する

自作プラグインは ai-doc のフォルダを直接読むため、この操作は不要（`git pull` で反映される）。

## 導入のスコープ

| 種別 | スコープ | 理由 |
|---|---|---|
| 自作（`private`） | プロジェクト単位（local） | プロジェクトごとに使う・使わないを選べるようにするため |
| 外部（`external`） | ユーザー単位（user） | プロジェクトごとに要否が変わるものではないため |

`aidoc install` は、外部プラグインが未導入の場合に導入するかを利用者に尋ね、承諾されたときだけ導入する。
外部プラグインを増やすときは marketplace.json にエントリを追加する。`aidoc` 側の変更は不要。

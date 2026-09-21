# ai-doc

プロジェクト横断で使う AI 向けドキュメント・スキル・エージェントを管理するリポジトリです。
Claude Code のプラグインとして各プロジェクトから参照するため、**このリポジトリを直せば、導入済みの全プロジェクトに反映されます**（コピーではありません）。

## 構成

```
ai-doc/
├── .claude-plugin/marketplace.json   マーケットプレイスの定義
├── plugins/
│   └── core/                         プラグイン本体
│       ├── .claude-plugin/plugin.json
│       ├── skills/<スキル名>/SKILL.md
│       ├── agents/<エージェント名>.md
│       └── _docs/                    スキル横断で使うガイド（導入先へ配るもの）
├── docs/                             このリポジトリ自体の運用ドキュメント
└── src/                              aidoc コマンド（入口は src/aidoc.js）
```

プラグインの定義方針（marketplace.json の記載項目、外部プラグインの扱い）は [docs/plugin-management.md](docs/plugin-management.md) にまとめています。

## 必要要件

- Node.js 20 以上
- git
- Claude Code

## セットアップ（マシンごとに1回）

```bash
git clone https://github.com/versu/ai-doc.git ~/repos/github.com/versu/ai-doc
cd ~/repos/github.com/versu/ai-doc
npm link
```

`npm link` を使わない場合は、以降の `aidoc` を `node <ai-doc のパス>/src/aidoc.js` に読み替えてください。

**クローンしたフォルダは移動・削除しないでください。** 各プロジェクトはこのフォルダを直接参照します。移動した場合は、各プロジェクトで `aidoc install` を実行し直してください。

## プロジェクトへの導入（プロジェクトごとに1回）

```bash
cd ~/repos/my-project
aidoc install
```

実行すると、次の設定とディレクトリが用意されます。

| 対象 | 内容 |
|---|---|
| `.claude/settings.local.json` | マーケットプレイスの登録、プラグインの有効化、ai-doc へのファイルアクセス許可、`"language": "japanese"`（未設定のときだけ追加） |
| `.ai/_docs` | ai-doc の `plugins/core/_docs` へのシンボリックリンク |
| `.ai/_tasks/_done/` | タスク管理用の空ディレクトリ |
| `.git/info/exclude` | `/.ai/` を追記（settings.local.json が未除外ならそれも追記） |
| 外部プラグイン | カタログに載せた外部プラグイン（`category: external`）が未導入の場合、導入するか確認したうえでユーザースコープに導入 |

対話モードで初めて起動したときは、フォルダを信頼するか聞かれます。**信頼しないとプラグインが読み込まれません。**

導入後は、スキルが `/core:commit` のように名前空間付きで使えます。自然文（「コミットして」など）で頼む場合は、名前空間を意識する必要はありません。

## 更新

ai-doc を更新するだけで、導入済みの全プロジェクトに反映されます（新しいセッションから有効）。

```bash
cd ~/repos/github.com/versu/ai-doc
git pull
```

スキルやエージェントを**追加**した場合も、各プロジェクトでの再実行は不要です。

カタログに外部プラグイン（他者が公開しているもの）を登録している場合、その最新化は次で行います。

```bash
aidoc update
```

## このリポジトリ自体を開発するとき

`plugins/core` 配下のスキルは、通常の起動では読み込まれません。プラグインとして読み込んで起動してください。

```bash
cd ~/repos/github.com/versu/ai-doc
claude --plugin-dir plugins/core
```

スキルを追加・変更するときの規約は [docs/skill-authoring.md](docs/skill-authoring.md) にまとめています。

## 導入の解除

```bash
cd ~/repos/my-project
aidoc uninstall
```

プラグインの導入、ファイルアクセス許可、`.ai/_docs` リンクを取り除きます。
マーケットプレイスの登録は、ai-doc のプラグインがどこかに導入されている間は残します（解除するとそれらも一緒に消えるため）。
どこにも残っていない場合だけ登録を解除します。
`.ai/_tasks` と Git のローカル除外設定は、作業内容が残るため削除しません。
プラグインのキャッシュ（`~/.claude/plugins/cache/ai-doc/`）も残るため、不要であれば削除してください。

## 旧方式（install.ps1）から移行する場合

旧方式でコピーされたファイルが残っていると、同名のスキルが二重に読み込まれます。導入先で次を削除してから `aidoc install` を実行してください。

- `.ai/docs/`
- `.claude/skills/`（ai-doc からコピーされたもの）
- `.claude/rules/`（ai-doc からコピーされたもの）

`.git/info/exclude` に残った `/.claude/` の行も、チーム共有の `.claude/` を隠してしまうため削除してください。

## トラブルシューティング

### `aidoc install` したのに `/core:commit` などが出てこない

実行中の Claude Code セッションには反映されません。**セッションを開き直してください。**
VS Code 拡張の場合は、ウィンドウを再読み込みします（コマンドパレットの `Developer: Reload Window`）。

`/reload-plugins` では反映されません。`aidoc install` が `.claude/settings.local.json` に書き込んだマーケットプレイスの登録は、Claude Code のプロセス起動時に読み込まれるためです。

## 補足

- Windows ネイティブでは、リンクは junction として作成されます（管理者権限は不要）。ただし動作は未検証です。
- プラグインが ai-doc のフォルダを直接読む挙動は、Claude Code 2.1.270 で確認したものです。将来のバージョンで変わった場合は、`claude plugin update core@ai-doc` が必要になる可能性があります。

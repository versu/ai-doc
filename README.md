# ai-doc

AI関連の各種ドキュメントとプロジェクト設定ファイルを管理するリポジトリです。

## 概要

このリポジトリには以下の設定ファイルが含まれています：
- `.ai` - AI関連のドキュメントとプロンプト
- `.claude` - Claude Codeの設定ファイル
- `.github` - GitHubワークフローとプロンプト

## 必要要件

- **PowerShell Core 7.0以上** が必要です
  - PowerShell 5.1（Windows標準）では動作しません
  - [PowerShell のインストール](https://learn.microsoft.com/ja-jp/powershell/scripting/install/installing-powershell)
- インターネット接続

## インストール方法

GitHubから直接スクリプトをダウンロードして実行します。

### Windows / Linux / macOS 共通

```powershell
# カレントディレクトリにインストール
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir .

# 特定のディレクトリにインストール
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir C:\Projects\MyProject

# 相対パスで指定
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir ../other-project

# 既存ファイルを確認せずに上書き（-Force オプション）
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir . -Force
```

####実行ポリシーエラーが出る場合

PowerShellの実行ポリシーでブロックされる場合は、以下のいずれかの方法を試してください：

**方法1: 一時的に実行ポリシーを変更（現在のセッションのみ）**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir .
```

**方法2: 一行で実行ポリシーをバイパス**
```powershell
pwsh -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir ."
```

## パラメータ

### -TargetDir (必須)

インストール先のディレクトリパスを指定します。

**指定可能な形式:**
- カレントディレクトリ: `.`
- 絶対パス:
  - Windows: `C:\Projects\MyProject`
  - Linux/macOS: `/home/user/project`
- 相対パス: `../other-project`

**例:**
```powershell
# カレントディレクトリ
-TargetDir .

# 絶対パス
-TargetDir C:\Users\username\MyProject

# 相対パス
-TargetDir ../my-project
```

### -Force (オプション)

既存ファイルの上書き確認をスキップします。

- このオプションを指定すると、すべてのファイルを確認なしで上書きします
- 指定しない場合、既存ファイルがあると上書き確認が表示されます
- エイリアス: `-f`, `-y`, `-yes`

**例:**
```powershell
# 既存ファイルを確認なしで上書き
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir . -Force

# エイリアスを使用
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir . -f
```

## ダウンロードされるファイル

インストールスクリプトは、以下のディレクトリとファイルをダウンロードします：

- `.ai/` - AI関連のドキュメントとプロンプト
  - `docs/` - 各種コーディング規約やルール
- `.claude/` - Claude Codeの設定ファイル
  - `commands/` - カスタムコマンド
  - `settings.json` など
- `.github/` - GitHubワークフローとプロンプト
  - `prompts/` - GitHub Copilot用プロンプト

## 使用例

### 例1: 新しいプロジェクトにインストール

```powershell
# 新しいプロジェクトディレクトリを作成
mkdir MyNewProject
cd MyNewProject

# ai-doc設定をインストール
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir .
```

### 例2: 既存プロジェクトに追加

```powershell
# 既存プロジェクトディレクトリに移動
cd C:\Projects\ExistingProject

# 上書き確認付きでインストール（既存ファイルがある場合は確認）
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir .
```

### 例3: 強制上書きで更新

```powershell
# 既存の設定を最新版で強制上書き
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir . -Force
```

## トラブルシューティング

### 実行ポリシーエラー

**エラーメッセージ:**
```
... cannot be loaded because running scripts is disabled on this system.
```

**解決方法:**
```powershell
# 現在のセッションのみ実行ポリシーを変更
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

または、`-ExecutionPolicy Bypass` オプション付きで pwsh を実行してください。

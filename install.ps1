#Requires -Version 7.0

<#
.SYNOPSIS
    ai-docプロジェクトの設定ファイルを別プロジェクトにインストールするスクリプト

.DESCRIPTION
    GitHub APIを使用してai-docリポジトリから設定ファイルを再帰的にダウンロードし、
    指定したターゲットディレクトリにインストールします。

    ダウンロード対象:
    - .ai ディレクトリ
    - .claude ディレクトリ
    - .github ディレクトリ

.PARAMETER TargetDir
    インストール先のディレクトリパス（必須）
    カレントディレクトリ、相対パス、絶対パスのいずれも指定可能です。

.PARAMETER Force
    既存ファイルの上書き確認をスキップします。
    このスイッチを指定すると、すべてのファイルを確認なしで上書きします。

.EXAMPLE
    .\install.ps1 C:\Projects\MyProject

    MyProjectディレクトリにai-docの設定ファイルをインストールします。
    既存ファイルがある場合は確認を求められます。

.EXAMPLE
    .\install.ps1 -TargetDir ./myproject -Force

    カレントディレクトリのmyprojectサブディレクトリにインストールします。
    既存ファイルは確認なしで上書きされます。

.EXAMPLE
    .\install.ps1 .

    カレントディレクトリに設定ファイルをインストールします。

.NOTES
    このスクリプトはPowerShell Core 7.0以上が必要です。
    Windows、Linux、macOSで動作します。

    リモートからの実行:
    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/versu/ai-doc/main/install.ps1))) -TargetDir <パス>

    詳細はREADMEを参照: https://github.com/versu/ai-doc
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $true, HelpMessage = "インストール先のディレクトリパス")]
    [string]$TargetDir,

    [Parameter()]
    [Alias('f', 'y', 'yes')]
    [switch]$Force
)

# エラーハンドリング設定
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# リポジトリ情報
$REPO_OWNER = "versu"
$REPO_NAME = "ai-doc"
$BRANCH = "main"

# ダウンロード対象ディレクトリ
$TARGET_DIRECTORIES = @('.ai', '.claude', '.github')

# 一時ディレクトリ用変数（クリーンアップのため）
$TempDir = $null

#region ユーティリティ関数

<#
.SYNOPSIS
    カラー付きメッセージを出力します。

.PARAMETER Message
    出力するメッセージ

.PARAMETER Type
    メッセージのタイプ（Info, Success, Warning, Error）
#>
function Write-ColorOutput {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter()]
        [ValidateSet('Info', 'Success', 'Warning', 'Error')]
        [string]$Type = 'Info'
    )

    $Color = switch ($Type) {
        'Info' { 'Cyan' }
        'Success' { 'Green' }
        'Warning' { 'Yellow' }
        'Error' { 'Red' }
    }

    Write-Host $Message -ForegroundColor $Color
}

<#
.SYNOPSIS
    既存ファイルの上書き確認を行います。

.PARAMETER FilePath
    確認するファイルのパス

.PARAMETER TargetDir
    ターゲットディレクトリ（相対パス表示用）

.PARAMETER Force
    強制上書きフラグ

.OUTPUTS
    上書きする場合はtrue、スキップする場合はfalse
#>
function Confirm-Overwrite {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string]$TargetDir,

        [Parameter()]
        [switch]$Force
    )

    if ($Force) {
        return $true
    }

    if (-not (Test-Path $FilePath)) {
        return $true
    }

    try {
        $RelativePath = [System.IO.Path]::GetRelativePath($TargetDir, $FilePath)
    }
    catch {
        $RelativePath = $FilePath
    }

    Write-ColorOutput "    警告: $RelativePath は既に存在します。上書きしますか？ (Y/N)" 'Warning'
    $Response = Read-Host
    return ($Response -match '^[Yy]$')
}

#endregion

#region GitHub関連関数

<#
.SYNOPSIS
    リポジトリのアーカイブ(tar.gz)を1回のリクエストで取得し、展開します。

.DESCRIPTION
    ファイルを個別にダウンロードするとリクエスト数が多くなり、
    raw.githubusercontent.com のレート制限(429 Too Many Requests)に
    抵触するため、リポジトリ全体を単一アーカイブとして取得して展開します。

.PARAMETER Owner
    リポジトリのオーナー

.PARAMETER Repo
    リポジトリ名

.PARAMETER Branch
    ブランチ名

.PARAMETER DestDir
    アーカイブの展開先ディレクトリ

.OUTPUTS
    展開されたリポジトリのルートディレクトリパス
#>
function Expand-GitHubArchive {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Owner,

        [Parameter(Mandatory = $true)]
        [string]$Repo,

        [Parameter(Mandatory = $true)]
        [string]$Branch,

        [Parameter(Mandatory = $true)]
        [string]$DestDir
    )

    # tar コマンドの存在確認(Windows 10 1803+ / macOS / Linux に標準搭載)
    if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
        throw "tar コマンドが見つかりません。tar が利用可能な環境で実行してください。"
    }

    $ArchiveUrl = "https://codeload.github.com/$Owner/$Repo/tar.gz/refs/heads/$Branch"
    $ArchivePath = Join-Path $DestDir 'repo.tar.gz'

    try {
        # アーカイブを1回のリクエストで取得
        Invoke-WebRequest -Uri $ArchiveUrl -OutFile $ArchivePath -ErrorAction Stop
    }
    catch {
        throw "リポジトリアーカイブの取得に失敗しました: $_"
    }

    try {
        # tar.gz を展開
        tar -xzf $ArchivePath -C $DestDir
        if ($LASTEXITCODE -ne 0) {
            throw "tar の終了コードが $LASTEXITCODE です。"
        }
    }
    catch {
        throw "リポジトリアーカイブの展開に失敗しました: $_"
    }

    # 展開トップは "Repo-<commitSHA>/" という可変名になるため動的に特定する
    $ExtractedRoot = Get-ChildItem -Path $DestDir -Directory |
        Where-Object { $_.Name -like "$Repo-*" } |
        Select-Object -First 1

    if (-not $ExtractedRoot) {
        throw "展開されたリポジトリのルートディレクトリが見つかりませんでした。"
    }

    return $ExtractedRoot.FullName
}

#endregion

#region メイン処理

try {
    # ターゲットディレクトリの存在確認
    if (-not (Test-Path -Path $TargetDir -PathType Container)) {
        throw "エラー: ターゲットディレクトリが存在しません: $TargetDir"
    }

    # 絶対パスに変換
    $TargetDir = [System.IO.Path]::GetFullPath($TargetDir, $PWD.Path)

    Write-Host ""
    Write-ColorOutput "ai-doc設定ファイルのインストールを開始します" 'Info'
    Write-ColorOutput "リポジトリ: https://github.com/$REPO_OWNER/$REPO_NAME" 'Info'
    Write-ColorOutput "ターゲット: $TargetDir" 'Info'
    Write-Host ""

    # 一時ディレクトリ作成
    $TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
    New-Item -ItemType Directory -Path $TempDir | Out-Null

    Write-ColorOutput "リポジトリを取得中..." 'Info'

    # リポジトリ全体を単一アーカイブとして取得・展開する(429対策)
    $ExtractedRoot = Expand-GitHubArchive -Owner $REPO_OWNER -Repo $REPO_NAME -Branch $BRANCH -DestDir $TempDir

    # 対象ディレクトリ配下のファイルを列挙
    # @() を使用して空の結果でも配列として扱う
    $FilesToInstall = @()
    foreach ($Dir in $TARGET_DIRECTORIES) {
        $SourceDir = Join-Path $ExtractedRoot $Dir
        if (Test-Path $SourceDir) {
            $FilesToInstall += Get-ChildItem -Path $SourceDir -Recurse -File
        }
    }

    $TotalFiles = $FilesToInstall.Count
    Write-ColorOutput "インストール対象: $TotalFiles ファイル" 'Info'
    Write-Host ""

    # インストール対象がない場合
    if ($TotalFiles -eq 0) {
        Write-ColorOutput "インストール対象のファイルが見つかりませんでした。" 'Warning'
        Write-ColorOutput "リポジトリに .ai, .claude, .github ディレクトリが存在するか確認してください。" 'Warning'
        exit 0
    }

    # 展開済みファイルをコピー(ここではネットワークアクセスは発生しない)
    $SuccessCount = 0
    $SkipCount = 0
    $FailCount = 0
    $CurrentFile = 0

    foreach ($File in $FilesToInstall) {
        $CurrentFile++
        $PercentComplete = ($CurrentFile / $TotalFiles) * 100

        # リポジトリ内の相対パス(表示は "/" 区切りに正規化)
        $RelativePath = [System.IO.Path]::GetRelativePath($ExtractedRoot, $File.FullName)
        $DisplayPath = $RelativePath -replace '\\', '/'
        $TargetFilePath = Join-Path $TargetDir $RelativePath

        Write-Progress -Activity "ファイルをインストール中" `
            -Status "$CurrentFile/$TotalFiles : $DisplayPath" `
            -PercentComplete $PercentComplete

        # 上書き確認
        if (Confirm-Overwrite -FilePath $TargetFilePath -TargetDir $TargetDir -Force:$Force) {
            try {
                $TargetFileDir = Split-Path -Parent $TargetFilePath
                if (-not (Test-Path $TargetFileDir)) {
                    New-Item -ItemType Directory -Path $TargetFileDir -Force | Out-Null
                }

                Copy-Item -Path $File.FullName -Destination $TargetFilePath -Force
                Write-Host "  " -NoNewline
                Write-Host "✓" -ForegroundColor Green -NoNewline
                Write-Host " $DisplayPath"
                $SuccessCount++
            }
            catch {
                Write-ColorOutput "  エラー: $DisplayPath のインストールに失敗しました - $_" 'Error'
                $FailCount++
            }
        }
        else {
            Write-Host "  スキップ: $DisplayPath" -ForegroundColor Yellow
            $SkipCount++
        }
    }

    Write-Progress -Activity "ファイルをインストール中" -Completed

    Write-Host ""
    Write-ColorOutput "インストールが完了しました！" 'Success'
    Write-ColorOutput "  成功: $SuccessCount ファイル" 'Success'
    if ($SkipCount -gt 0) {
        Write-ColorOutput "  スキップ: $SkipCount ファイル" 'Warning'
    }
    if ($FailCount -gt 0) {
        Write-ColorOutput "  失敗: $FailCount ファイル" 'Error'
    }
    Write-Host ""

    # 失敗があった場合は終了コード1
    if ($FailCount -gt 0) {
        exit 1
    }
}
catch {
    Write-Host ""
    Write-ColorOutput "エラー: $_" 'Error'
    exit 1
}
finally {
    # クリーンアップ
    if ($TempDir -and (Test-Path $TempDir)) {
        Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

#endregion

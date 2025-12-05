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
$API_BASE = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME"
$RAW_BASE = "https://raw.githubusercontent.com/$REPO_OWNER/$REPO_NAME/$BRANCH"

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
    GitHub APIから再帰的なツリー構造を取得します。

.PARAMETER Owner
    リポジトリのオーナー

.PARAMETER Repo
    リポジトリ名

.PARAMETER Branch
    ブランチ名

.OUTPUTS
    ツリーオブジェクトの配列
#>
function Get-GitHubTreeRecursive {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Owner,

        [Parameter(Mandatory = $true)]
        [string]$Repo,

        [Parameter(Mandatory = $true)]
        [string]$Branch
    )

    $Url = "https://api.github.com/repos/$Owner/$Repo/git/trees/${Branch}?recursive=1"

    try {
        $Response = Invoke-RestMethod -Uri $Url -Method Get -Headers @{
            'Accept'     = 'application/vnd.github.v3+json'
            'User-Agent' = 'PowerShell-Installer'
        }
        return $Response.tree
    }
    catch {
        throw "GitHub APIからのツリー取得に失敗しました: $_"
    }
}

<#
.SYNOPSIS
    指定されたパスがダウンロード対象かどうかを判定します。

.PARAMETER Path
    判定するパス

.OUTPUTS
    ダウンロード対象の場合はtrue、それ以外はfalse
#>
function Test-ShouldDownload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    # 対象ディレクトリのいずれかに含まれているか
    foreach ($Dir in $TARGET_DIRECTORIES) {
        if ($Path -like "$Dir/*" -or $Path -eq $Dir) {
            return $true
        }
    }

    return $false
}

<#
.SYNOPSIS
    GitHubから個別ファイルをダウンロードします。

.PARAMETER FilePath
    ダウンロードするファイルのリポジトリ内パス

.PARAMETER DestPath
    保存先のローカルパス

.OUTPUTS
    成功した場合はtrue、失敗した場合はfalse
#>
function Get-FileFromGitHub {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string]$DestPath
    )

    $Url = "$RAW_BASE/$FilePath"

    try {
        # ディレクトリ作成
        $DestDir = Split-Path -Parent $DestPath
        if (-not (Test-Path $DestDir)) {
            New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
        }

        # ダウンロード
        Invoke-WebRequest -Uri $Url -OutFile $DestPath -ErrorAction Stop
        return $true
    }
    catch {
        Write-ColorOutput "  エラー: $FilePath のダウンロードに失敗しました - $_" 'Error'
        return $false
    }
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

    Write-ColorOutput "ファイルリストを取得中..." 'Info'

    # GitHub APIからツリー取得
    $Tree = Get-GitHubTreeRecursive -Owner $REPO_OWNER -Repo $REPO_NAME -Branch $BRANCH

    # フィルタリング（ファイルのみ、対象ディレクトリのみ）
    # @() を使用して空の結果でも配列として扱う
    $FilesToDownload = @($Tree | Where-Object {
            $_.type -eq 'blob' -and (Test-ShouldDownload $_.path)
        })

    $TotalFiles = $FilesToDownload.Count
    Write-ColorOutput "ダウンロード対象: $TotalFiles ファイル" 'Info'
    Write-Host ""

    # ダウンロード対象がない場合
    if ($TotalFiles -eq 0) {
        Write-ColorOutput "ダウンロード対象のファイルが見つかりませんでした。" 'Warning'
        Write-ColorOutput "リポジトリに .ai, .claude, .github ディレクトリが存在するか確認してください。" 'Warning'
        exit 0
    }

    # ダウンロードとインストール
    $SuccessCount = 0
    $SkipCount = 0
    $FailCount = 0
    $CurrentFile = 0

    foreach ($File in $FilesToDownload) {
        $CurrentFile++
        $PercentComplete = ($CurrentFile / $TotalFiles) * 100

        Write-Progress -Activity "ファイルをダウンロード中" `
            -Status "$CurrentFile/$TotalFiles : $($File.path)" `
            -PercentComplete $PercentComplete

        $TempFilePath = Join-Path $TempDir $File.path
        $TargetFilePath = Join-Path $TargetDir $File.path

        # ダウンロード
        if (Get-FileFromGitHub -FilePath $File.path -DestPath $TempFilePath) {
            # 上書き確認
            if (Confirm-Overwrite -FilePath $TargetFilePath -TargetDir $TargetDir -Force:$Force) {
                $TargetFileDir = Split-Path -Parent $TargetFilePath
                if (-not (Test-Path $TargetFileDir)) {
                    New-Item -ItemType Directory -Path $TargetFileDir -Force | Out-Null
                }

                Copy-Item -Path $TempFilePath -Destination $TargetFilePath -Force
                Write-Host "  " -NoNewline
                Write-Host "✓" -ForegroundColor Green -NoNewline
                Write-Host " $($File.path)"
                $SuccessCount++
            }
            else {
                Write-Host "  スキップ: $($File.path)" -ForegroundColor Yellow
                $SkipCount++
            }
        }
        else {
            $FailCount++
        }
    }

    Write-Progress -Activity "ファイルをダウンロード中" -Completed

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

param(
    [string]$CodexHome = (Join-Path $env:USERPROFILE '.codex'),
    [switch]$IncludeConfig
)

$ErrorActionPreference = 'Stop'

function Resolve-AbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [System.IO.Path]::GetFullPath($Path)
}

function Ensure-Directory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Backup-AndCopy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    $result = 'created'

    if (Test-Path -LiteralPath $Destination) {
        $sourceText = Get-Content -LiteralPath $Source -Raw
        $destinationText = Get-Content -LiteralPath $Destination -Raw

        if ($sourceText -eq $destinationText) {
            return 'unchanged'
        }

        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupPath = "$Destination.bak.$timestamp"
        Copy-Item -LiteralPath $Destination -Destination $backupPath
        $result = "updated (backup: $backupPath)"
    }

    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    return $result
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-AbsolutePath (Join-Path $scriptRoot '..')
$codexHomePath = Resolve-AbsolutePath $CodexHome

Ensure-Directory -Path $codexHomePath

$syncItems = @(
    [pscustomobject]@{
        Name        = 'AGENTS.md'
        Source      = Join-Path $repoRoot 'AGENTS.md'
        Destination = Join-Path $codexHomePath 'AGENTS.md'
    }
)

if ($IncludeConfig) {
    $syncItems += [pscustomobject]@{
        Name        = 'config.toml'
        Source      = Join-Path $repoRoot 'templates\codex-home\config.toml'
        Destination = Join-Path $codexHomePath 'config.toml'
    }
}

$results = foreach ($item in $syncItems) {
    [pscustomobject]@{
        Name        = $item.Name
        Source      = $item.Source
        Destination = $item.Destination
        Status      = Backup-AndCopy -Source $item.Source -Destination $item.Destination
    }
}

[pscustomobject]@{
    CodexHome = $codexHomePath
    Synced    = $results
}


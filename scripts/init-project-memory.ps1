param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath
)

$ErrorActionPreference = 'Stop'

function Resolve-AbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return (Resolve-Path -LiteralPath $Path).Path
}

function Copy-IfMissing {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    if (Test-Path -LiteralPath $Destination) {
        return $false
    }

    $parent = Split-Path -Parent $Destination
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    Copy-Item -LiteralPath $Source -Destination $Destination
    return $true
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-AbsolutePath (Join-Path $scriptRoot '..')
$templatesRoot = Join-Path $repoRoot 'templates\project-memory'

if (-not (Test-Path -LiteralPath $ProjectPath)) {
    New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null
}

$projectRoot = Resolve-AbsolutePath $ProjectPath
$aiRoot = Join-Path $projectRoot '.ai'
$handoffRoot = Join-Path $aiRoot 'handoffs'

New-Item -ItemType Directory -Path $aiRoot -Force | Out-Null
New-Item -ItemType Directory -Path $handoffRoot -Force | Out-Null

$copyResults = @(
    [pscustomobject]@{
        Source      = Join-Path $templatesRoot 'business-context.md'
        Destination = Join-Path $aiRoot 'business-context.md'
    },
    [pscustomobject]@{
        Source      = Join-Path $templatesRoot 'defect-patterns.md'
        Destination = Join-Path $aiRoot 'defect-patterns.md'
    },
    [pscustomobject]@{
        Source      = Join-Path $templatesRoot 'current-state.md'
        Destination = Join-Path $aiRoot 'current-state.md'
    },
    [pscustomobject]@{
        Source      = Join-Path $templatesRoot 'decisions.md'
        Destination = Join-Path $aiRoot 'decisions.md'
    },
    [pscustomobject]@{
        Source      = Join-Path $templatesRoot 'handoff-template.md'
        Destination = Join-Path $handoffRoot 'handoff-template.md'
    }
)

$created = @()
foreach ($item in $copyResults) {
    if (Copy-IfMissing -Source $item.Source -Destination $item.Destination) {
        $created += $item.Destination
    }
}

[pscustomobject]@{
    ProjectRoot = $projectRoot
    AiRoot      = $aiRoot
    Created     = $created
}

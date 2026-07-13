$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $repoRoot
try {
  $env:MASTER_ARCHIVE_SOURCE_COMMIT = (git rev-parse HEAD).Trim()
  npm.cmd run archive:data

  $runtimeRoot = Join-Path $repoRoot 'artifacts\master-archive\runtime'
  $runtimeModules = Join-Path $runtimeRoot 'node_modules'
  $bundledRoot = Join-Path $HOME '.cache\codex-runtimes\codex-primary-runtime\dependencies\node'
  $nodeExe = if ($env:CODEX_PRIMARY_NODE) { $env:CODEX_PRIMARY_NODE } else { Join-Path $bundledRoot 'bin\node.exe' }
  $bundledModules = if ($env:CODEX_PRIMARY_NODE_MODULES) { $env:CODEX_PRIMARY_NODE_MODULES } else { Join-Path $bundledRoot 'node_modules' }

  if (-not (Test-Path -LiteralPath $nodeExe)) {
    throw "Codex spreadsheet runtime was not found at $nodeExe. Set CODEX_PRIMARY_NODE to its node executable."
  }
  if (-not (Test-Path -LiteralPath $bundledModules)) {
    throw "Codex spreadsheet modules were not found at $bundledModules. Set CODEX_PRIMARY_NODE_MODULES to that node_modules folder."
  }

  New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
  if (-not (Test-Path -LiteralPath $runtimeModules)) {
    New-Item -ItemType Junction -Path $runtimeModules -Target $bundledModules | Out-Null
  }

  $env:MASTER_ARCHIVE_REPO_ROOT = $repoRoot
  $runtimeBuilder = Join-Path $runtimeRoot 'buildMasterWorkbook.mjs'
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'buildMasterWorkbook.mjs') -Destination $runtimeBuilder -Force
  & $nodeExe $runtimeBuilder
  if ($LASTEXITCODE -ne 0) { throw "Workbook generation failed with exit code $LASTEXITCODE." }
}
finally {
  Pop-Location
}

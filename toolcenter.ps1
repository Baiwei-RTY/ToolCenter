[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("plugin-dev", "release-build", "verify")]
  [string]$Command = "plugin-dev"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$toolDirectories = @("node", "corepack", "pnpm", "cargo") |
  ForEach-Object {
    $resolvedCommand = Get-Command $_ -CommandType Application -ErrorAction Stop | Select-Object -First 1
    Split-Path -Parent $resolvedCommand.Source
  } |
  Select-Object -Unique

$sanitizedPathEntries = $env:Path -split ";" |
  ForEach-Object { $_.Trim().Trim('"') } |
  Where-Object { $_ -ne "" }
$env:Path = (@($toolDirectories) + @($sanitizedPathEntries) | Select-Object -Unique) -join ";"

$pnpmScript = switch ($Command) {
  "plugin-dev" { "plugin:dev" }
  "release-build" { "release:build" }
  "verify" { "verify" }
}

& corepack pnpm $pnpmScript
exit $LASTEXITCODE

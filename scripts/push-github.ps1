# Create GitHub repo and push (requires gh CLI: https://cli.github.com/)
param(
  [Parameter(Mandatory = $true)]
  [string]$RepoName,
  [switch]$Public
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "Install GitHub CLI: https://cli.github.com/"
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Install Git: https://git-scm.com/download/win"
}

if (-not (Test-Path ".git")) {
  git init
  git branch -M main
}

git add .
git commit -m "Oil crack backtest demo" 2>$null

$visibility = if ($Public) { "--public" } else { "--private" }
gh repo create $RepoName $visibility --source=. --remote=origin --push

$owner = (gh api user -q .login)
$repoUrl = "https://github.com/$owner/$RepoName"
Write-Host ""
Write-Host "Repository: $repoUrl"
Write-Host "Deploy button (already configured for salmasaidane):"
Write-Host "  https://heroku.com/deploy?template=$repoUrl"

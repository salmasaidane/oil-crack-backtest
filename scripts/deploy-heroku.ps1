# Deploy oil-crack-backtest to Heroku (requires git, heroku CLI, and npm in PATH)
param(
  [string]$AppName = "",
  [string]$GitHubRepo = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing '$name' in PATH. Install it and retry."
  }
}

Require-Command git
Require-Command npm
Require-Command heroku

if (-not (Test-Path ".git")) {
  git init
  git branch -M main 2>$null
}

if (-not (git status --porcelain)) {
  Write-Host "No changes to commit."
} else {
  git add .
  git commit -m "Deploy oil crack backtest demo"
}

npm install
npm run build

if ($AppName) {
  $exists = heroku apps:info -a $AppName 2>$null
  if (-not $exists) {
    heroku create $AppName
  } else {
    heroku git:remote -a $AppName 2>$null
  }
} elseif (-not (git remote get-url heroku 2>$null)) {
  heroku create
}

Write-Host ""
Write-Host "Set EIA_API_KEY on Heroku for real product prices (optional):"
Write-Host "  heroku config:set EIA_API_KEY=your_key -a <app-name>"
Write-Host ""

git push heroku main
if ($LASTEXITCODE -ne 0) {
  git push heroku master
}

heroku open

if ($GitHubRepo) {
  Write-Host ""
  Write-Host "Enable one-click deploy: set repository in app.json to $GitHubRepo and push to GitHub."
}

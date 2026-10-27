# 把本地仓库推到 GitHub。用法：
#   .\tools\publish.ps1 -Repo "https://github.com/你/st-mirage-phone.git"
# 需要本机已经能免密登录 GitHub（credential store 或 SSH）。
param(
    [Parameter(Mandatory = $true)][string]$Repo,
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path ".git")) { throw "这里不是 git 仓库" }

$existing = git remote get-url origin 2>$null
if ($existing) {
    git remote set-url origin $Repo
} else {
    git remote add origin $Repo
}

Write-Output "推送到 $Repo ..."
git push -u origin $Branch
git push origin --tags
Write-Output "完成。记得把 manifest.json 里的 homePage 改成 $Repo"

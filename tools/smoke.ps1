# 预览冒烟测试：逐个应用打开，检查页面有没有报错
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$routes = @("home", "chat", "chat&thread=t1", "chat&thread=t3", "moments", "contacts", "photos", "notes", "wallet", "weather", "settings")
$fail = 0
foreach ($route in $routes) {
    $profile = Join-Path $PWD (".chrome-smoke-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
    $out = Join-Path $PWD ("shots\smoke-" + ($route -replace '[^a-z0-9]', '_') + ".html")
    $url = "http://127.0.0.1:7788/preview/?theme=dark&app=" + $route
    & $chrome --headless=new --disable-gpu --no-first-run --user-data-dir=$profile --window-size=1280,1000 --virtual-time-budget=4500 --dump-dom $url 2>$null | Out-File -Encoding utf8 $out
    $dom = Get-Content $out -Raw
    $m = [regex]::Match($dom, 'id="boot-error"[^>]*>([\s\S]*?)</div>')
    $msg = if ($m.Success) { $m.Groups[1].Value.Trim() } else { "<no boot-error div>" }
    $failed = ($dom -match 'data-preview-error="1"') -or ($msg -ne "")
    if ($failed) { $fail++ }
    Write-Output ("{0,-22} {1}" -f $route, $(if ($failed) { "FAIL: " + ($msg -replace '\s+', ' ') } else { "ok" }))
    Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
}
Write-Output ("failures: " + $fail)

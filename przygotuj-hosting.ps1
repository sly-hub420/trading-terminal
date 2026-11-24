# Kopiuje do folderu "trading-terminal-www" na pulpicie tylko pliki strony (bez kodu serwera i SQL).
# Ten folder przeciągasz na Netlify (Deploys -> przeciągnij folder).
$src = $PSScriptRoot
$dst = Join-Path ([Environment]::GetFolderPath("Desktop")) "trading-terminal-www"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Path $dst | Out-Null
foreach ($p in "index.html", "manifest.webmanifest", "css", "js", "icons") { Copy-Item -Recurse (Join-Path $src $p) $dst }
Write-Host "Gotowe: $dst - przeciagnij ten folder na Netlify."
explorer.exe $dst

# Launch locally with the SQLite PDO extension, even when php.ini is absent.
$ErrorActionPreference = 'Stop'
$phpCommand = Get-Command php -ErrorAction Stop
$phpDirectory = Split-Path -Parent $phpCommand.Source
$extensionDirectory = Join-Path $phpDirectory 'ext'
$publicDirectory = Join-Path $PSScriptRoot 'public'
& $phpCommand.Source -r "exit(in_array('sqlite', PDO::getAvailableDrivers(), true) ? 0 : 1);"
$sqliteIsConfigured = $LASTEXITCODE -eq 0
Write-Host 'Steep & Sip POS: http://127.0.0.1:8080 (Ctrl+C to stop)'
if ($sqliteIsConfigured) {
    & $phpCommand.Source -S 127.0.0.1:8080 -t $publicDirectory
} else {
    & $phpCommand.Source -d "extension_dir=$extensionDirectory" -d 'extension=pdo_sqlite' -S 127.0.0.1:8080 -t $publicDirectory
}

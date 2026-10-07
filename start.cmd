@echo off
setlocal
rem Resolve PHP on PATH, and enable SQLite only when it is not already loaded.
set "POS_PHP="
for /f "delims=" %%P in ('where php.exe 2^>nul') do if not defined POS_PHP set "POS_PHP=%%P"
if not defined POS_PHP (
    echo PHP was not found. Install PHP and add its folder to PATH.
    pause
    exit /b 1
)
for %%P in ("%POS_PHP%") do set "POS_PHP_DIRECTORY=%%~dpP"
set "POS_SQLITE_ARGS="
"%POS_PHP%" -r "exit(in_array('sqlite', PDO::getAvailableDrivers(), true) ? 0 : 1);"
if errorlevel 1 set POS_SQLITE_ARGS=-d "extension_dir=%POS_PHP_DIRECTORY%ext" -d extension=pdo_sqlite
"%POS_PHP%" %POS_SQLITE_ARGS% -r "echo 'SQLite PDO driver: ', in_array('sqlite', PDO::getAvailableDrivers(), true) ? 'ready' : 'missing', PHP_EOL; exit(in_array('sqlite', PDO::getAvailableDrivers(), true) ? 0 : 1);"
if errorlevel 1 (
    echo SQLite could not be loaded. Enable extension=pdo_sqlite in PHP's php.ini.
    pause
    exit /b 1
)
if /i "%~1"=="--check" exit /b 0
echo Steep ^& Sip POS: http://127.0.0.1:8080
echo Leave this window open. Press Ctrl+C to stop the server.
"%POS_PHP%" %POS_SQLITE_ARGS% -S 127.0.0.1:8080 -t "%~dp0public"

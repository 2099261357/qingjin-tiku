@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
echo ============================================
echo    Qingjin Tiku - Paper Bank Updater
echo ============================================
echo.
echo Put NEW papers (PDF / images) into the "papers_inbox" folder,
echo then double-click this file.
echo.
echo Processing...
echo.
"C:\Users\LENOVO\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" "tools\add_papers.py"
echo.
echo ============================================
echo Done. Next: drag the "static" folder to Netlify to update the site.
echo ============================================
pause

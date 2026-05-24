@echo off
REM ================================================================
REM  Texas Energy Risk Alert Platform — Local Git Setup Script
REM  Run this once from the texas-energy-risk\ folder in PowerShell
REM  or Command Prompt:  cd texas-energy-risk && deploy-setup.bat
REM ================================================================

echo.
echo [1/4] Initializing git repository...
git init -b main
git config user.name "TX Energy Risk"
git config user.email "your@email.com"

echo.
echo [2/4] Adding all files...
git add .

echo.
echo [3/4] Creating initial commit...
git commit -m "feat: Texas Energy Risk Alert Platform MVP"

echo.
echo [4/4] Done! Now run:
echo.
echo   git remote add origin https://github.com/YOUR_USERNAME/texas-energy-risk.git
echo   git push -u origin main
echo.
echo Then proceed with Railway and Vercel deployment per docs\SETUP.md
pause

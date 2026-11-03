@echo off
rem Chay Vite dev server va mo trinh duyet bang "start" cua CMD.
rem Khong dung "vite --open" vi Vite goi PowerShell de mo trinh duyet va bi chan (spawn EPERM).
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install || exit /b 1
)

rem Doi ~3 giay cho server san sang roi moi mo trinh duyet. Doi duong dan neu muon mo trang khac.
start "" /b cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:5173/content/progression-rules"

rem strictPort: neu 5173 dang bi chiem thi bao loi thay vi tu doi sang port khac (de URL o tren luon dung).
call npm run dev -- --port 5173 --strictPort

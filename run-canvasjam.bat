@echo off
title CanvasJam Whiteboard
cd /d "%~dp0"
set "PATH=%~dp0..\node\node-v20.12.2-win-x64;%~dp0..\mingit\cmd;%PATH%"
echo ====================================================
echo        Starting CanvasJam Whiteboard Server
echo ====================================================
echo Opening http://localhost:3000 in your browser...
start http://localhost:3000
call npm start
pause

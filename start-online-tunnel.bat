@echo off
title CanvasJam Online Share Tunnel
cd /d "C:\Users\ankit\.gemini\antigravity\scratch"
echo Starting public tunnel...
start "" "%~dp0cloudflared.exe" tunnel --url http://localhost:3000
pause

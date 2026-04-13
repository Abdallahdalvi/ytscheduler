@echo off
REM ========================================
REM   YT Scheduler - Complete Startup
REM   One file to start everything
REM ========================================

setlocal enabledelayedexpansion
set "ROOT=%~dp0"
cd /d "%ROOT%"

if not exist "%ROOT%backend-node\package.json" (
	echo.
	echo ERROR: Backend folder not found.
	echo Expected: "%ROOT%backend-node"
	pause
	exit /b 1
)

if not exist "%ROOT%frontend\package.json" (
	echo.
	echo ERROR: Frontend folder not found.
	echo Expected: "%ROOT%frontend"
	pause
	exit /b 1
)

echo.
echo ╔════════════════════════════════════════╗
echo ║   YT Scheduler - Starting Services     ║
echo ╚════════════════════════════════════════╝
echo.
echo Backend API:  http://localhost:8080
echo Frontend:     http://localhost:5173
echo.

REM Kill any existing services on these ports (optional cleanup)
for /f "tokens=5" %%a in ('netstat -aon ^| find "8080" ^| find "LISTENING"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find "5173" ^| find "LISTENING"') do taskkill /f /pid %%a 2>nul

echo Starting Backend API...
start "Backend API (8080)" cmd /k "cd /d ""%ROOT%backend-node"" && npm run dev"

echo Waiting for backend to initialize...
timeout /t 3 /nobreak

echo Starting Frontend Dev Server...
start "Frontend (5173)" cmd /k "cd /d ""%ROOT%frontend"" && npm run dev"

echo Waiting for frontend to start...
timeout /t 4 /nobreak

echo.
echo ╔════════════════════════════════════════╗
echo ║   Services Started Successfully!       ║
echo ╚════════════════════════════════════════╝
echo.
echo Opening browser...
timeout /t 1 /nobreak
start http://localhost:5173

echo.
echo ✓ Backend: http://localhost:8080
echo ✓ Frontend: http://localhost:5173
echo.
echo Both services are running in separate windows.
echo Close either window to stop that service.
echo.
pause

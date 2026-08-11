@echo off
REM ---------------------------------------------------------------------------
REM  Starts the fingerprint receiver and keeps it running.
REM
REM  Registered as a Windows scheduled task that fires at logon, so nobody has to
REM  remember to launch it. If the receiver ever exits it is restarted after 10
REM  seconds -- a crashed receiver looks exactly like a dead device, and the shop
REM  would not find out until payroll.
REM ---------------------------------------------------------------------------

cd /d "%~dp0.."

:loop
node --experimental-strip-types --no-warnings scripts\device-receiver.ts >> "%TEMP%\fingerprint-receiver.log" 2>&1
echo [%date% %time%] receiver exited, restarting in 10s >> "%TEMP%\fingerprint-receiver.log"
timeout /t 10 /nobreak >nul
goto loop

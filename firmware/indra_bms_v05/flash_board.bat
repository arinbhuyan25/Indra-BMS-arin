@echo off
echo ==============================================================
echo INDRA-BMS V0.5 UPLOADER (COM11)
echo ==============================================================
echo Make sure the Arduino IDE Serial Monitor is CLOSED!
echo Press RESET on your VSDSquadron-Ultra when you see the dots...
echo.
"C:\Users\arjun\AppData\Local\Arduino15\packages\vega\tools\vegaxmodem\002\xmodem.bat" COM11 "%~dp0indra_bms_v05.ino.bin"
echo.
pause

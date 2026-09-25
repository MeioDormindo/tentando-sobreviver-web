@echo off
rem Gera o executável do jogo para testar: godot\build\windows\TentandoSobreviver.exe
rem (um arquivo só, com o jogo embutido). Precisa do Godot 4.7.2 em E:\Tools\Godot e dos
rem export templates 4.7.2 instalados (%APPDATA%\Godot\export_templates\4.7.2.stable).
setlocal
set GODOT=E:\Tools\Godot\Godot_v4.7.2-stable_win64_console.exe
cd /d "%~dp0.."
if not exist build\windows mkdir build\windows
"%GODOT%" --headless --path . --export-release "Windows" build\windows\TentandoSobreviver.exe
if errorlevel 1 (
  echo.
  echo Falhou a exportacao.
  pause
  exit /b 1
)
echo.
echo Pronto: %cd%\build\windows\TentandoSobreviver.exe
pause

@echo off

"C:\Program Files\7-Zip\7z.exe" a -tzip Voyage_AI_Tour_Planner.zip . ^
-x!frontend\node_modules ^
-x!backend\__pycache__ ^
-x!.git ^
-x!.vscode ^
-x!*.log ^
-x!*.pyc

pause
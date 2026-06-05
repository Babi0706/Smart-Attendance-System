@echo off
echo Initializing git repository...
git init

echo.
echo Adding files...
git add .

echo.
echo Committing files...
git commit -m "Initial commit"

echo.
echo Setting main branch...
git branch -M main

echo.
echo Adding remote origin...
git remote add origin https://github.com/Babi0706/Smart-Attendance-System.git

echo.
echo Pushing to GitHub...
git push -u origin main

echo.
echo Done! If everything worked, your code is now on GitHub.
pause

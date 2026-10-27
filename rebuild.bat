@echo off
echo Rebuilding and restarting docker containers...
docker-compose down
docker-compose build
docker-compose up -d
echo Done.
pause

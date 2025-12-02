
## For the dockerfile

# Building the app docker image
docker build -t nest-task-api .

docker run --env-file .env.stage.dev -p 3000:3000 --name nest-task-api nest-task-api
----------------------------------------------
## For the docker-compose file:

# choose stage and run
$env:STAGE='dev'; docker compose up --build
or
docker compose --env-file .env.stage.dev up --build -d

to just run: $env:STAGE='dev'; docker compose up

# or detached
$env:STAGE='dev'; docker compose up --build -d

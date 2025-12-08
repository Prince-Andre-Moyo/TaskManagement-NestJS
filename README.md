## To run the DB together with yarn start:dev
docker run -d --name task-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=taskmanagement -p 5432:5432 postgres:15

then
yarn start:dev

-----------------------------------------------------------------------------------
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

# to stop:
docker compose -f docker-compose.yml stop

--------------------------------------------------------------------------
## To run the docker-compose for logging

docker compose -f docker-compose.logging.yml up -d

Then browse Grafana at http://localhost:5000

# to stop (but keep containers):
docker compose -f docker-compose.logging.yml stop

# Stop and remove containers:
docker compose -f docker-compose.logging.yml down
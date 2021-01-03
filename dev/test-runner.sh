#!/usr/bin/env bash
PWD="$(pwd)"
echo $PWD
cd "$(dirname "$0")"
if [[ $1 == 'start' ]]; then
    docker-compose -f docker-compose.postgres.yml -f docker-compose.redis.yml -f docker-compose.kafka.yml up -d
    
    DOCKER_RUNNING_INSTANCES=1
    while :; do
        DOCKER_RUNNING_INSTANCES=$(docker ps | grep 'health' | grep -vE 'healthy' | wc -l)
        ((DOCKER_RUNNING_INSTANCES > 0)) || break
        echo "waiting for healthy instances...$DOCKER_RUNNING_INSTANCES"
        sleep 3
    done
    sleep 7 #for kafka elections
else
    docker-compose -f docker-compose.postgres.yml -f docker-compose.redis.yml -f docker-compose.kafka.yml down
fi
cd $PWD
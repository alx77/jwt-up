#!/usr/bin/env bash
if [[ $1 == 'start' ]]; then
    docker-compose -f dev/docker-compose.postgres.yml -f dev/docker-compose.redis.yml -f dev/docker-compose.kafka.yml up -d
    
    DOCKER_RUNNING_INSTANCES=1
    while :; do
        DOCKER_RUNNING_INSTANCES=$(docker ps | grep 'health' | grep -vE 'healthy' | wc -l)
        ((DOCKER_RUNNING_INSTANCES > 0)) || break
        echo "waiting for healthy instances...$DOCKER_RUNNING_INSTANCES"
        sleep 3
    done
    sleep 5 #for kafka elections
else
    docker-compose -f dev/docker-compose.postgres.yml -f dev/docker-compose.redis.yml -f dev/docker-compose.kafka.yml down
fi
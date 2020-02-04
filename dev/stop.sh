#!/bin/bash
docker-compose --f docker-compose.mongo.yml \
-f docker-compose.graylog.yml \
-f docker-compose.grafana.yml \
down -v

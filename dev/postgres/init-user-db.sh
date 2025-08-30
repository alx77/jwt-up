#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    DROP USER IF EXISTS portal;
    DROP DATABASE IF EXISTS portal;
    CREATE DATABASE portal;
    CREATE USER portal WITH PASSWORD 'secret';
    GRANT ALL PRIVILEGES ON DATABASE portal TO portal;
EOSQL
psql -U "$POSTGRES_USER" -d portal -f ../create.sql
psql -U "$POSTGRES_USER" -d portal -f ../data.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -d portal <<-EOSQL
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO portal;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO portal;
    GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO portal;
EOSQL

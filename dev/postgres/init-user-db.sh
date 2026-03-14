#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    DROP USER IF EXISTS auth;
    DROP DATABASE IF EXISTS auth;
    CREATE DATABASE auth;
    CREATE USER auth WITH PASSWORD 'secret';
    GRANT ALL PRIVILEGES ON DATABASE auth TO auth;
EOSQL
psql -U "$POSTGRES_USER" -d auth -f ../create.sql
psql -U "$POSTGRES_USER" -d auth -f ../data.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -d auth <<-EOSQL
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO auth;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO auth;
    GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO auth;
EOSQL

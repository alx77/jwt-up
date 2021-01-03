CREATE SCHEMA IF NOT EXISTS jwtup;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS jwtup.users (
    id serial PRIMARY KEY,
    obj jsonb NOT NULL DEFAULT '{}' ::jsonb
);

CREATE OR REPLACE FUNCTION cast_ts(text)
  RETURNS timestamptz AS
$$SELECT CASE $1 WHEN NULL THEN NULL ELSE to_timestamp($1, 'YYYY-MM-DD HH24:MI:SS.MS') END$$
  LANGUAGE sql IMMUTABLE;

CREATE INDEX IF NOT EXISTS user_name_idx ON jwtup.users USING btree ((obj ->> 'name'::text) COLLATE pg_catalog. "default" ASC NULLS LAST);
CREATE UNIQUE INDEX IF NOT EXISTS user_email_idx ON jwtup.users USING btree ((obj ->> 'email'::text) COLLATE pg_catalog. "default" ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS user_created_at_idx ON jwtup.users(cast_ts(obj ->> 'created_at') ASC NULLS LAST);
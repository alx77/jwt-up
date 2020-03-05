CREATE SCHEMA IF NOT EXISTS jwtup;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS jwtup.users (
    id serial PRIMARY KEY,
    obj jsonb NOT NULL DEFAULT '{}' ::jsonb
);

CREATE INDEX IF NOT EXISTS user_name_idx ON jwtup.users USING btree ((obj ->> 'name'::text) COLLATE pg_catalog. "default" ASC NULLS LAST);
CREATE UNIQUE INDEX IF NOT EXISTS user_email_idx ON jwtup.users USING btree ((obj ->> 'email'::text) COLLATE pg_catalog. "default" ASC NULLS LAST);

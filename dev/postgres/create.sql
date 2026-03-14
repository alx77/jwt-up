-- Database generated with pgModeler (PostgreSQL Database Modeler).
-- pgModeler version: 1.1.3
-- PostgreSQL version: 16.0
-- Project Site: pgmodeler.io
-- Model Author: Alex Furmanov

-- Database creation must be performed outside a multi lined SQL file. 
-- These commands were put in this file only as a convenience.
-- 
-- -- object: auth | type: DATABASE --
-- -- DROP DATABASE IF EXISTS auth;
-- CREATE DATABASE auth
-- 	ENCODING = 'UTF8'
-- 	LC_COLLATE = 'en_US.utf8'
-- 	LC_CTYPE = 'en_US.utf8'
-- 	TABLESPACE = pg_default
-- 	OWNER = postgres;
-- -- ddl-end --
-- 

-- object: public.account_id_seq | type: SEQUENCE --
-- DROP SEQUENCE IF EXISTS public.account_id_seq CASCADE;
CREATE SEQUENCE public.account_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START WITH 10
	CACHE 1
	NO CYCLE
	OWNED BY NONE;

-- ddl-end --
ALTER SEQUENCE public.account_id_seq OWNER TO postgres;
-- ddl-end --

-- object: public.role_id_seq | type: SEQUENCE --
-- DROP SEQUENCE IF EXISTS public.role_id_seq CASCADE;
CREATE SEQUENCE public.role_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START WITH 10
	CACHE 1
	NO CYCLE
	OWNED BY NONE;

-- ddl-end --
ALTER SEQUENCE public.role_id_seq OWNER TO postgres;
-- ddl-end --

-- object: public.permission_id_seq | type: SEQUENCE --
-- DROP SEQUENCE IF EXISTS public.permission_id_seq CASCADE;
CREATE SEQUENCE public.permission_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 9223372036854775807
	START WITH 1
	CACHE 1
	NO CYCLE
	OWNED BY NONE;

-- ddl-end --
ALTER SEQUENCE public.permission_id_seq OWNER TO postgres;
-- ddl-end --

-- object: public.account | type: TABLE --
-- DROP TABLE IF EXISTS public.account CASCADE;
CREATE TABLE public.account (
	id bigint NOT NULL DEFAULT nextval('public.account_id_seq'::regclass),
	uid uuid NOT NULL DEFAULT gen_random_uuid(),
	login character varying(255) NOT NULL,
	passwd character varying(255) NOT NULL,
	email character varying(255) DEFAULT NULL,
	name character varying(255) DEFAULT NULL,
	start_date timestamptz DEFAULT now(),
	status smallint NOT NULL DEFAULT 2,
	CONSTRAINT account_pkey PRIMARY KEY (id),
	CONSTRAINT account_uid_uq UNIQUE (uid),
	CONSTRAINT account_login_uq UNIQUE (login),
	CONSTRAINT account_email_uq UNIQUE (email)
);
-- ddl-end --
COMMENT ON COLUMN public.account.uid IS E'External identifier. Exposed as 22-char Base64url via UuidBase64.ts';
-- ddl-end --
COMMENT ON COLUMN public.account.passwd IS E'Argon2id hash';
-- ddl-end --
COMMENT ON COLUMN public.account.status IS E'1=ACTIVE, 2=BLOCKED, 3=TEMPORARY_BLOCKED';
-- ddl-end --
ALTER TABLE public.account OWNER TO postgres;
-- ddl-end --

-- object: public.role | type: TABLE --
-- DROP TABLE IF EXISTS public.role CASCADE;
CREATE TABLE public.role (
	id integer NOT NULL DEFAULT nextval('public.role_id_seq'::regclass),
	name character varying(100) NOT NULL,
	CONSTRAINT role_pkey PRIMARY KEY (id),
	CONSTRAINT role_name_uq UNIQUE (name)
);
-- ddl-end --
COMMENT ON COLUMN public.role.name IS E'Machine-readable name: admin, manager, operator, registered, guest';
-- ddl-end --
ALTER TABLE public.role OWNER TO postgres;
-- ddl-end --

-- object: public.account_roles | type: TABLE --
-- DROP TABLE IF EXISTS public.account_roles CASCADE;
CREATE TABLE public.account_roles (
	account_id bigint NOT NULL,
	role_id integer NOT NULL,
	CONSTRAINT account_roles_pkey PRIMARY KEY (account_id,role_id)
);
-- ddl-end --
ALTER TABLE public.account_roles OWNER TO postgres;
-- ddl-end --

-- object: public.permissions | type: TABLE --
-- DROP TABLE IF EXISTS public.permissions CASCADE;
CREATE TABLE public.permissions (
	id bigint NOT NULL DEFAULT nextval('public.permission_id_seq'::regclass),
	role_id integer NOT NULL,
	action character varying(50) NOT NULL,
	resource_type character varying(100) NOT NULL,
	resource_id bigint DEFAULT NULL,
	conditions jsonb DEFAULT NULL,
	CONSTRAINT permissions_pkey PRIMARY KEY (id),
	CONSTRAINT permissions_uq UNIQUE (role_id,action,resource_type,resource_id)
);
-- ddl-end --
COMMENT ON COLUMN public.permissions.action IS E'read | create | update | delete';
-- ddl-end --
COMMENT ON COLUMN public.permissions.resource_type IS E'product | order | account | * (wildcard)';
-- ddl-end --
COMMENT ON COLUMN public.permissions.resource_id IS E'NULL = permission applies to all objects of the type (RBAC). NOT NULL = permission applies to a specific object (ABAC lvl 1)';
-- ddl-end --
COMMENT ON COLUMN public.permissions.conditions IS E'Arbitrary ABAC lvl 2 conditions interpreted by the application. Example: {"category_id": 5}';
-- ddl-end --
COMMENT ON CONSTRAINT permissions_uq ON public.permissions IS E'NULL resource_id is included in uniqueness. In PostgreSQL NULL != NULL, so multiple rows with NULL resource_id do not conflict — this is intentional.';
-- ddl-end --
ALTER TABLE public.permissions OWNER TO postgres;
-- ddl-end --

-- object: fk_ar_account | type: CONSTRAINT --
-- ALTER TABLE public.account_roles DROP CONSTRAINT IF EXISTS fk_ar_account CASCADE;
ALTER TABLE public.account_roles ADD CONSTRAINT fk_ar_account FOREIGN KEY (account_id)
REFERENCES public.account (id) MATCH SIMPLE
ON DELETE CASCADE ON UPDATE CASCADE;
-- ddl-end --

-- object: fk_ar_role | type: CONSTRAINT --
-- ALTER TABLE public.account_roles DROP CONSTRAINT IF EXISTS fk_ar_role CASCADE;
ALTER TABLE public.account_roles ADD CONSTRAINT fk_ar_role FOREIGN KEY (role_id)
REFERENCES public.role (id) MATCH SIMPLE
ON DELETE CASCADE ON UPDATE CASCADE;
-- ddl-end --

-- object: fk_permissions_role | type: CONSTRAINT --
-- ALTER TABLE public.permissions DROP CONSTRAINT IF EXISTS fk_permissions_role CASCADE;
ALTER TABLE public.permissions ADD CONSTRAINT fk_permissions_role FOREIGN KEY (role_id)
REFERENCES public.role (id) MATCH SIMPLE
ON DELETE CASCADE ON UPDATE CASCADE;
-- ddl-end --



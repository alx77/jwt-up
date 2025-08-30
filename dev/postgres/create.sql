CREATE SEQUENCE public.acl_object_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START WITH 10
	CACHE 1
	NO CYCLE
	OWNED BY NONE;

ALTER SEQUENCE public.acl_object_id_seq OWNER TO postgres;

CREATE TABLE public.acl_object (
	id integer NOT NULL DEFAULT nextval('public.acl_object_id_seq'::regclass),
	CONSTRAINT acl_object_pkey PRIMARY KEY (id)
);

CREATE SEQUENCE public.account_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START WITH 10
	CACHE 1
	NO CYCLE
	OWNED BY NONE;

ALTER SEQUENCE public.account_id_seq OWNER TO postgres;

CREATE TABLE public.account (
	id bigint NOT NULL DEFAULT nextval('public.account_id_seq'::regclass),
	uid uuid DEFAULT gen_random_uuid(),
	login character varying(255) NOT NULL,
	passwd character varying(64) NOT NULL,
	email character varying(255) DEFAULT NULL,
	name character varying(255) DEFAULT NULL,
	start_date timestamptz,
	status smallint DEFAULT '1',
	CONSTRAINT account_pkey PRIMARY KEY (id)
);

ALTER TABLE public.account OWNER TO postgres;

CREATE SEQUENCE public.role_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START WITH 10
	CACHE 1
	NO CYCLE
	OWNED BY NONE;

ALTER SEQUENCE public.role_id_seq OWNER TO postgres;

CREATE TABLE public.role (
	id integer NOT NULL DEFAULT nextval('public.role_id_seq'::regclass),
	name character varying(100) NOT NULL,
	CONSTRAINT role_pkey PRIMARY KEY (id)
);

ALTER TABLE public.role OWNER TO postgres;

CREATE TABLE public.acl (
	group_role_id integer,
	role_id integer,
	account_id integer,
	acl_object_id integer,
	r_read boolean DEFAULT true,
	r_execute boolean DEFAULT true,
	r_create boolean DEFAULT true,
	r_modify boolean DEFAULT true,
	r_delete boolean DEFAULT true,
	r_rights boolean DEFAULT true
);

ALTER TABLE public.acl OWNER TO postgres;

CREATE UNIQUE INDEX login_idx ON public.account
USING btree
(
	login
)
WITH (FILLFACTOR = 90);

CREATE INDEX fk_account_tree1 ON public.account
USING btree
(
	id
)
WITH (FILLFACTOR = 90);

CREATE UNIQUE INDEX role_name_idx ON public.role
USING btree
(
	name
)
WITH (FILLFACTOR = 90);

CREATE INDEX fk_acl_account_id ON public.acl
USING btree
(
	account_id
)
WITH (FILLFACTOR = 90);

CREATE INDEX fk_acl_role_id ON public.acl
USING btree
(
	role_id
)
WITH (FILLFACTOR = 90);

CREATE INDEX fk_acl_acl_object1 ON public.acl
USING btree
(
	acl_object_id
)
WITH (FILLFACTOR = 90);

CREATE INDEX fk_acl_role1 ON public.acl
USING btree
(
	group_role_id
)
WITH (FILLFACTOR = 90);

CREATE UNIQUE INDEX uniqueidx ON public.acl
USING btree
(
	group_role_id,
	role_id,
	account_id,
	acl_object_id
)
WITH (FILLFACTOR = 90);

ALTER TABLE public.acl ADD CONSTRAINT fk_role_account_id FOREIGN KEY (account_id)
REFERENCES public.account (id) MATCH SIMPLE
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.acl ADD CONSTRAINT fk_role_id FOREIGN KEY (role_id)
REFERENCES public.role (id) MATCH SIMPLE
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.acl ADD CONSTRAINT fk_acl_acl_object1 FOREIGN KEY (acl_object_id)
REFERENCES public.acl_object (id) MATCH SIMPLE
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.acl ADD CONSTRAINT fk_acl_role1 FOREIGN KEY (group_role_id)
REFERENCES public.role (id) MATCH SIMPLE
ON DELETE CASCADE ON UPDATE CASCADE;


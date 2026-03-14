-- Seed data for jwt-up auth service
-- Passwords are empty strings (set real hashes before use)

INSERT INTO public.account (id, login, passwd, email, name, start_date, status) VALUES
(1, 'guest',  '', NULL,              'Guest', NOW(), 1),
(2, 'admin',  '', 'admin@site.com',  'Admin', NOW(), 1),
(3, 'job',    '', 'job@site.com',    'Job',   NOW(), 1);

INSERT INTO public.role (id, name) VALUES
(1, 'guest'),
(2, 'admin'),
(3, 'manager'),
(4, 'operator'),
(5, 'registered');

INSERT INTO public.account_roles (account_id, role_id) VALUES
(1, 1),  -- guest    → guest
(2, 2),  -- admin    → admin
(3, 4);  -- job      → operator

-- RBAC permissions per role
-- admin: full access to everything
INSERT INTO public.permissions (role_id, action, resource_type) VALUES
(2, 'read',   '*'),
(2, 'create', '*'),
(2, 'update', '*'),
(2, 'delete', '*');

-- manager: read and write, no delete
INSERT INTO public.permissions (role_id, action, resource_type) VALUES
(3, 'read',   '*'),
(3, 'create', '*'),
(3, 'update', '*');

-- operator: accounts only, no delete
INSERT INTO public.permissions (role_id, action, resource_type) VALUES
(4, 'read',   'account'),
(4, 'create', 'account'),
(4, 'update', 'account');

-- registered: own profile only (ABAC — resource_id is set dynamically by the application)
INSERT INTO public.permissions (role_id, action, resource_type) VALUES
(5, 'read',   'account'),
(5, 'update', 'account');

-- guest: read public content only
INSERT INTO public.permissions (role_id, action, resource_type) VALUES
(1, 'read', 'content');

-- Reset sequences after manual INSERTs with explicit ids
SELECT setval('public.account_id_seq', (SELECT MAX(id) FROM public.account));
SELECT setval('public.role_id_seq',    (SELECT MAX(id) FROM public.role));

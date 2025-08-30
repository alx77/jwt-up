INSERT INTO "account" ("id", "login", "passwd", "email", "name", "start_date", "status") VALUES
(1, 'guest', '', NULL, 'Guest', NOW(), 1),
(2, 'admin', '', 'admin@site.com', 'Admin', NOW(), 1),
(3, 'job', '', 'job@site.com', 'Job', NOW(), 1);

INSERT INTO "role" (id, "name") VALUES
(1, 'guest'),
(2, 'admin'),
(3, 'manager'),
(4, 'operator'),
(5, 'registered');

INSERT INTO acl (group_role_id, role_id, account_id, acl_object_id, r_read, r_execute, r_create, r_modify, r_delete, r_rights) VALUES
(NULL, 1, 1, NULL, true, false, false, false, false, false),
(NULL, 2, 2, NULL, true, true, true, true, true, true),
(NULL, 4, 3, NULL, true, true, true, true, true, false);

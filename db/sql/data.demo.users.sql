INSERT INTO jwtup.users
    VALUES (1, '{}'); --TODO add admin here

SELECT setval(pg_get_serial_sequence('jwtup.users', 'id'), (SELECT MAX(id) FROM jwtup.users) + 1);


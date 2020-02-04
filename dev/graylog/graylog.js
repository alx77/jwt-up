graylog = db.getSiblingDB('graylog');
graylog.createUser(
  {
    user: "graylog",
    pwd: "eWGzncmBe9",
    roles: [
      { role: "dbOwner", db: "graylog" }
    ]
  }
);
const headers = {
  authorization: "jwt-decode",
};
module.exports = {
  read: {
    headers,
    params: {
      user_id: "hash-decode",
    },
  },
  readByEmail: {
    headers,
  },
  refreshToken: {
    headers,
  },
  update: {
    headers,
    body: {
      user_id: "hash-decode",
    },
  },
  del: {
    headers,
    params: {
      user_id: "hash-decode",
    },
  },
  list: {
    headers,
    query: {
      filter: "qs",
    },
  },
};

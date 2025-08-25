const headers = {
  authorization: "jwt-decode",
};
module.exports = {
  read: {
    headers,
  },
  update: {
    headers,
  },
  del: {
    headers,
  },
  refreshToken: {
    headers
  }
};

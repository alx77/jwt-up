const headers = {
    authorization: "jwt-decode"
};
module.exports = {
    create: {
        headers,
        body: {
            uid: "hash-decode"
        }
    },
    read: {
        headers,
        params: {
            uid: "hash-decode"
        }
    },
    readByEmail: {
        headers
    },
    update: {
        headers,
        body: {
            uid: "hash-decode",
        }
    },
    del: {
        headers,
        params: {
            uid: "hash-decode"
        }
    },
    list: {
        headers
    }
}

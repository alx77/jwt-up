const Hashids = require("hashids/cjs");
const cfg = require("./config");

const salt = cfg.get("HASHIDS_SALT");
const hashLength = 10;

function encodeId(id) {
    const hashIds = new Hashids(salt, hashLength);
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
        throw new Error("Id is non-arithmetic number");
    }
    return hashIds.encode(parsedId);
}

function decodeId(hashid) {
    const hashIds = new Hashids(salt, hashLength);
    const idArr = hashIds.decode(hashid);
    if (!!idArr.length) {
        return idArr[0];
    }
    throw new Error("Error during id decoding");
}

module.exports = { encodeId, decodeId };

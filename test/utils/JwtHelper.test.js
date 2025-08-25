const chai = require("chai");
const expect = chai.expect;
const jwtHelper = require("../../src/utils/JwtHelper");

describe(`@JwtHelper tests`, function () {
  it("@JwtHelper.1 - Check encode/decode", async () => {
    const obj = {
      ver: 1,
      aud: "api://default",
      cid: "0oa4lqm29K4tBnwVq0x6",
      uid: "00u4gg8e8n3mzdL6P0x6",
      scp: ["groups", "openid", "profile", "email"],
      sub: "jwt-up@ugolok.com",
      groups: ["test users", "Everyone"],
    };

    const encoded = await jwtHelper.getAccessToken(obj);
    const decoded = await jwtHelper.decodeToken(encoded);
    delete decoded.exp;
    delete decoded.iat;
    delete decoded.iss;
    expect(obj).deep.equal(decoded);

    const decodedSync = jwtHelper.decodeTokenSync(encoded);
    delete decodedSync.exp;
    delete decodedSync.iat;
    delete decodedSync.iss;
    expect(obj).deep.equal(decodedSync);

    const jwk = await jwtHelper.getJwk();
  });
});

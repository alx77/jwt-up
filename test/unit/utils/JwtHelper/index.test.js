import { describe, it, expect } from "vitest";
import jwtHelper from "@/utils/JwtHelper";

describe(`@utils - JwtHelper tests`, function () {

  const obj = {
    ver: 1,
    cid: "0oa4lqm29K4tBnwVq0x6",
    uid: "00u4gg8e8n3mzdL6P0x6",
    scp: ["groups", "openid", "profile", "email"],
    sub: "jwt-up@ugolok.com",
    groups: ["test users", "Everyone"],
  };

  it("Check encode/decode", async () => {
  
    const encoded = await jwtHelper.getAccessToken(obj);
    const decoded = await jwtHelper.decodeToken(encoded);
    
    const { exp, iat, iss, jti, ...cleanDecoded } = decoded;
    expect(cleanDecoded).toEqual(obj);

    const decodedSync = jwtHelper.decodeTokenSync(encoded);
    const { exp: expSync, iat: iatSync, iss: issSync, jti: jtiSync, ...cleanDecodedSync } = decodedSync;
    expect(cleanDecodedSync).toEqual(obj);

    const jwk = await jwtHelper.getJwk();
    expect(jwk).toBeDefined();
  });

  it("Check Refresh Token", async () => {
  
    const refresh = await jwtHelper.getRefreshToken(obj);
    const decodedRefresh = await jwtHelper.decodeToken(refresh);
    expect(decodedRefresh.aud).toEqual("refresh")
    
    const {iss, exp, iat, jti, aud, ...cleanDecodedRefresh} = decodedRefresh
    expect(cleanDecodedRefresh).toEqual(obj)

  })
});
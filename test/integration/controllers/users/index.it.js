import { describe, it, expect, afterAll, vi, beforeEach, afterEach } from "vitest";
import { addUser, getUser, removeUser, getAccessToken, getRefreshToken } from "@test/integration/TestHelper.js";
import { AccountStatus, AccountRole } from "@/services/users/index.js";
import redis from "@/utils/RedisHelper.js";
import { transporter } from "@/utils/EmailHelper.js";
import { pg } from "@/utils/KnexHelper.js";

import request from "supertest";
import { app, server } from "../../../../index.js";

const ACTIVATION_CODE_PREFIX = "act_";

describe("@users tests", () => {
  let userUuid;
  let activationCodeWithPrefix;
  const user = {
    name: "Jane",
    login: "jane",
    email: "jane@example.com",
    password: "!$Secret123$",
    ip: "127.0.0.1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Registering new user", async () => {
    // Arrange
    const redisSpy = vi.spyOn(redis, "setex");
    const transporterSpy = vi.spyOn(transporter, "sendMail");

    const response = await request(app).post("/api/auth/user").send(user).expect("Content-Type", /json/).expect(200);

    expect(response.body).toEqual({ status: "OK" });
    expect(redisSpy).toHaveBeenCalled();

    const calls = redisSpy.mock.calls;
    [activationCodeWithPrefix, , userUuid] = calls[0];
    const activationCode = activationCodeWithPrefix.substring(ACTIVATION_CODE_PREFIX.length);

    expect(transporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        text: expect.stringContaining(encodeURIComponent(activationCode)),
      }),
      expect.any(Function),
    );

    const userData = await getUser(userUuid, activationCodeWithPrefix);

    expect(userData).toMatchObject({
      user_id: userUuid,
      redisUserId: userUuid,
    });
  });

  it("Activating user account", async () => {
    //Arrange
    let activationCode;
    ({ userUuid, activationCode } = await addUser({
      ...user,
      roles: [AccountRole.REGISTERED],
    }));

    // Act
    const response = await request(app)
      .get(`/api/auth/activate/${encodeURIComponent(activationCode)}`)
      .expect(200);

    // Assert
    expect(response.body).toHaveProperty("user_id");
    expect(response.body).toHaveProperty("access_token");
    expect(response.body).toHaveProperty("refresh_token");

    const userData = await getUser(userUuid, ACTIVATION_CODE_PREFIX + activationCode);
    expect(userData.user_id).toBe(userUuid);
    expect(userData.redisUserId).toBeNull(); // No Redis key after activation
  });

  it("Logging in user", async () => {
    //Arrange
    let activationCode;
    ({ userUuid, activationCode } = await addUser({
      ...user,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.REGISTERED],
    }));
    activationCodeWithPrefix = ACTIVATION_CODE_PREFIX + activationCode; // to clean record in afterEach

    // Act & Assert
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(200);
    expect(response.body).toHaveProperty("user_id");
    expect(response.body).toHaveProperty("access_token");
    expect(response.body).toHaveProperty("refresh_token");
    // Optionally decode JWT to verify claims
  });

  it("Refreshing access token", async () => {
    //Arrange
    let activationCode;
    ({ userUuid, activationCode } = await addUser({
      ...user,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.REGISTERED],
    }));
    activationCodeWithPrefix = ACTIVATION_CODE_PREFIX + activationCode; // to clean record in afterEach

    // Login first
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(200);
    const refreshToken = loginRes.body.refresh_token;

    // Act & Assert
    const response = await request(app)
      .get("/api/auth/refresh")
      .set("Authorization", `Bearer ${refreshToken}`)
      .expect(200);
    expect(response.body).toHaveProperty("access_token");
    expect(response.body).toHaveProperty("refresh_token");
  });

  it("Reading own user details", async () => {
    //Arrange
    let activationCode;
    ({ userUuid, activationCode } = await addUser({
      ...user,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.REGISTERED],
    }));
    activationCodeWithPrefix = ACTIVATION_CODE_PREFIX + activationCode; // to clean record in afterEach

    const accessToken = await getAccessToken(userUuid);

    // Act & Assert
    const response = await request(app).get("/api/auth/user").set("Authorization", `Bearer ${accessToken}`).expect(200);

    expect(response.body.user).toMatchObject({
      email: user.email,
      name: user.name,
    });
  });

  it("Logout user and reject subsequent refresh", async () => {
    // Arrange
    let activationCode;
    ({ userUuid, activationCode } = await addUser({
      ...user,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.REGISTERED],
    }));
    activationCodeWithPrefix = ACTIVATION_CODE_PREFIX + activationCode;

    const accessToken = await getAccessToken(userUuid);
    const refreshToken = await getRefreshToken(userUuid);

    // Act — logout with both tokens
    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refresh_token: refreshToken })
      .expect(200);

    // Assert — refresh token is now blacklisted
    const refreshResponse = await request(app)
      .get("/api/auth/refresh")
      .set("Authorization", `Bearer ${refreshToken}`)
      .expect(401);

    expect(refreshResponse.body).toMatchObject({ error: { message: "UNAUTHORIZED" } });
  });

  afterEach(async () => {
    if (userUuid || activationCodeWithPrefix) {
      await removeUser(userUuid, activationCodeWithPrefix);
      userUuid = null;
      activationCodeWithPrefix = null;
    }
  });

  afterAll(async () => {
    await pg.destroy();
    await redis.quit();
    await transporter.close();

    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });
});
//TODO
// - update user
// - delete user
// - test for invalid activation code
// - test for login with invalid credentials
// - test for refresh with invalid/expired token
// - test for reading user details with invalid/expired token

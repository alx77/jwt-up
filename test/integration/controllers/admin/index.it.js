import { describe, it, expect, afterAll, vi, beforeEach, afterEach } from "vitest";
import { addUser, getAccessToken, removeUser } from "@test/integration/TestHelper.js";
import { AccountStatus, AccountRole } from "@/services/users/index.js";
import { encode } from "@/utils/UuidBase64.js";
import redis from "@/utils/RedisHelper.js";
import { transporter } from "@/utils/EmailHelper.js";
import { pg } from "@/utils/KnexHelper.js";
import request from "supertest";
import { app, server } from "../../../../index.js";

const ACTIVATION_CODE_PREFIX = "act_";

describe("@admin tests", () => {
  let adminUuid;
  let adminActivationCode;
  let testUserUuid;
  let testUserActivationCode;

  const adminUser = {
    name: "Admin",
    login: "testadmin",
    email: "testadmin@example.com",
    password: "!$Secret123$",
    ip: "127.0.0.1",
  };

  const testUser = {
    name: "Bob",
    login: "bobtestuser",
    email: "bob@example.com",
    password: "!$Secret123$",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (adminUuid) {
      await removeUser(adminUuid, adminActivationCode);
      adminUuid = null;
      adminActivationCode = null;
    }
    if (testUserUuid) {
      await removeUser(testUserUuid, testUserActivationCode);
      testUserUuid = null;
      testUserActivationCode = null;
    }
  });

  afterAll(async () => {
    await pg.destroy();
    await redis.quit();
    await transporter.close();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("Listing accounts", async () => {
    // Arrange
    let activationCode;
    ({ userUuid: adminUuid, activationCode } = await addUser({
      ...adminUser,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.ADMIN],
    }));
    adminActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    ({ userUuid: testUserUuid, activationCode } = await addUser({
      ...testUser,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.REGISTERED],
    }));
    testUserActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    const adminToken = await getAccessToken(adminUuid);

    // Act
    const response = await request(app)
      .get("/api/admin/accounts")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    // Assert
    expect(response.body.status).toBe("OK");
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(typeof response.body.total).toBe("number");
    expect(response.body.total).toBeGreaterThanOrEqual(2);
    expect(response.body.page).toBe(1);
    expect(response.body.per_page).toBe(20);
  });

  it("Listing accounts filtered by status", async () => {
    // Arrange
    let activationCode;
    ({ userUuid: adminUuid, activationCode } = await addUser({
      ...adminUser,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.ADMIN],
    }));
    adminActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    ({ userUuid: testUserUuid, activationCode } = await addUser({
      ...testUser,
      status: AccountStatus.BLOCKED,
      roles: [AccountRole.REGISTERED],
    }));
    testUserActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    const adminToken = await getAccessToken(adminUuid);

    // Act
    const response = await request(app)
      .get("/api/admin/accounts?status=2")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    // Assert
    expect(response.body.status).toBe("OK");
    expect(response.body.items.every((u) => u.status === AccountStatus.BLOCKED)).toBe(true);
  });

  it("Getting account by ID", async () => {
    // Arrange
    let activationCode;
    ({ userUuid: adminUuid, activationCode } = await addUser({
      ...adminUser,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.ADMIN],
    }));
    adminActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    ({ userUuid: testUserUuid, activationCode } = await addUser({
      ...testUser,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.REGISTERED],
    }));
    testUserActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    const adminToken = await getAccessToken(adminUuid);
    const testUserId = encodeURIComponent(encode(testUserUuid));

    // Act
    const response = await request(app)
      .get(`/api/admin/accounts/${testUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    // Assert
    expect(response.body.status).toBe("OK");
    expect(response.body.user).toMatchObject({
      email: testUser.email,
      login: testUser.login,
    });
  });

  it("Getting account by ID returns 404 for unknown id", async () => {
    // Arrange
    let activationCode;
    ({ userUuid: adminUuid, activationCode } = await addUser({
      ...adminUser,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.ADMIN],
    }));
    adminActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    const adminToken = await getAccessToken(adminUuid);

    // Act & Assert
    const response = await request(app)
      .get("/api/admin/accounts/AAAAAAAAAAAAAAAAAAAAaa")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);

    expect(response.body).toMatchObject({ error: { message: "USER_NOT_FOUND" } });
  });

  it("Updating account status", async () => {
    // Arrange
    let activationCode;
    ({ userUuid: adminUuid, activationCode } = await addUser({
      ...adminUser,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.ADMIN],
    }));
    adminActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    ({ userUuid: testUserUuid, activationCode } = await addUser({
      ...testUser,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.REGISTERED],
    }));
    testUserActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    const adminToken = await getAccessToken(adminUuid);
    const testUserId = encodeURIComponent(encode(testUserUuid));

    // Act
    const response = await request(app)
      .patch(`/api/admin/accounts/${testUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: AccountStatus.BLOCKED })
      .expect(200);

    // Assert
    expect(response.body.status).toBe("OK");
    expect(response.body.user.status).toBe(AccountStatus.BLOCKED);
  });

  it("Deleting account", async () => {
    // Arrange
    let activationCode;
    ({ userUuid: adminUuid, activationCode } = await addUser({
      ...adminUser,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.ADMIN],
    }));
    adminActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    ({ userUuid: testUserUuid, activationCode } = await addUser({
      ...testUser,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.REGISTERED],
    }));
    testUserActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    const adminToken = await getAccessToken(adminUuid);
    const testUserId = encodeURIComponent(encode(testUserUuid));

    // Act
    await request(app)
      .delete(`/api/admin/accounts/${testUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    // Assert — second delete returns 404
    const response = await request(app)
      .delete(`/api/admin/accounts/${testUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);

    expect(response.body).toMatchObject({ error: { message: "USER_NOT_FOUND" } });
    testUserUuid = null; // Already deleted, skip afterEach cleanup
    testUserActivationCode = null;
  });

  it("Non-admin user cannot access admin endpoints", async () => {
    // Arrange
    let activationCode;
    ({ userUuid: testUserUuid, activationCode } = await addUser({
      ...testUser,
      status: AccountStatus.ACTIVE,
      roles: [AccountRole.REGISTERED],
    }));
    testUserActivationCode = ACTIVATION_CODE_PREFIX + activationCode;

    const userToken = await getAccessToken(testUserUuid);

    // Act & Assert
    await request(app)
      .get("/api/admin/accounts")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(403);
  });
});

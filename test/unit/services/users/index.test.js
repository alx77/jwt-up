import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock(import("@/utils/KnexHelper.js"));
vi.mock(import("@/utils/RedisHelper.js"));
vi.mock(import("@/utils/EmailHelper.js"));

describe("@users tests", () => {
  let userService;
  let mockPg;
  let mockRedis;
  let mockTransporter;
  let mockUuidBase64;
  let mockJwtHelper;
  let mockCryptoHelper;

  beforeEach(async () => {
    await vi.resetModules();

    const KnexHelper = await import("@/utils/KnexHelper.js");
    mockPg = KnexHelper.pg;

    const RedisHelper = await import("@/utils/RedisHelper.js");
    mockRedis = RedisHelper.default;

    const EmailHelper = await import("@/utils/EmailHelper.js");
    mockTransporter = EmailHelper.transporter;

    vi.mock(import("@/utils/UuidBase64.js"), () => {
      return {
        encode: vi.fn(),
        decode: vi.fn(),
      };
    });
    mockUuidBase64 = await import("@/utils/UuidBase64.js");

    vi.mock(import("@/utils/JwtHelper.js"), () => {
      return {
        default: {
          getAccessToken: vi.fn(),
          getRefreshToken: vi.fn(),
        },
      };
    });
    mockJwtHelper = (await import("@/utils/JwtHelper.js")).default;
    vi.mock(import("@/utils/CryptoHelper.js"), () => {
      return {
        verifyPassword: vi.fn(),
        hashPassword: vi.fn(),
      };
    });
    mockCryptoHelper = await import("@/utils/CryptoHelper.js");
    const UserServiceModule = await import(
      "@/services/users/index.js"
    );

    userService = UserServiceModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("register user tests", () => {
    const mockUser = {
      login: "testuser",
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    };
    const baseUrl = "http://localhost:3000";

    beforeEach(() => {
      mockPg._setMockResult([{ uid: "123e4567-e89b-12d3-a456-426614174000" }]);
      mockUuidBase64.encode.mockReturnValue("encoded_uid");
    });
    it("should successfully register a user", async () => {
      const result = await userService.registerUser(mockUser, baseUrl);

      expect(result).toEqual({ user_id: "encoded_uid" });
      expect(mockPg.with).toHaveBeenCalledTimes(2);
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it("should handle duplicate user error", async () => {
      const duplicateError = new Error("Duplicate key");
      duplicateError.code = "23505";
      duplicateError.constraint = "account_login_uq";

      mockPg._setMockResult(duplicateError);

      await expect(userService.registerUser(mockUser, baseUrl)).rejects.toThrow(
        "USER_ALREADY_EXISTS"
      );

      await expect(
        userService.registerUser(mockUser, baseUrl)
      ).rejects.toMatchObject({ status: 409, message: "USER_ALREADY_EXISTS" });
    });

    it("should handle general database errors", async () => {
      const dbError = new Error("Database connection failed");
      mockPg._setMockResult(dbError);

      await expect(userService.registerUser(mockUser, baseUrl)).rejects.toThrow(
        "Database connection failed"
      );
    });

    it("should store activation code in redis with correct prefix", async () => {
      mockUuidBase64.encode
        .mockReturnValueOnce("encoded_uid")
        .mockReturnValueOnce("activation_code");

      await userService.registerUser(mockUser, baseUrl);

      const setexCall = mockRedis.setex.mock.calls[0];
      expect(setexCall[0]).toBe("act_activation_code");
    });

    it("should send email with correct activation URL", async () => {
      mockUuidBase64.encode
        .mockReturnValueOnce("encoded_uid")
        .mockReturnValueOnce("activation_code");

      await userService.registerUser(mockUser, baseUrl);

      const sendMailCall = mockTransporter.sendMail.mock.calls[0];
      const mailOptions = sendMailCall[0];

      expect(mailOptions.to).toBe(mockUser.email);
      expect(mailOptions.subject).toBe("Activation email");
      expect(mailOptions.html).toContain("activation_code");
      expect(mailOptions.html).toContain(mockUser.name);
    });
  });

  describe("activate user tests", () => {
    const activationCode = "test_activation_code";
    const userUuid = "123e4567-e89b-12d3-a456-426614174000";
    const mockUserData = [
      {
        email: "test@example.com",
        roles: ["REGISTERED"],
      },
    ];

    beforeEach(() => {
      mockUuidBase64.encode.mockReturnValue("encoded_uid");
      mockUuidBase64.decode.mockReturnValue(userUuid);
      mockJwtHelper.getAccessToken.mockResolvedValue("access_token");
      mockJwtHelper.getRefreshToken.mockResolvedValue("refresh_token");
    });

    it("should successfully activate user", async () => {
      mockRedis.get.mockResolvedValue(userUuid);
      mockPg._setMockResult(mockUserData);

      const result = await userService.activate(activationCode);

      expect(result).toEqual({
        user_id: "encoded_uid",
        access_token: "access_token",
        refresh_token: "refresh_token",
      });
      expect(mockRedis.get).toHaveBeenCalledWith("act_" + activationCode);
      expect(mockPg.with).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith("act_" + activationCode);
    });

    it("should throw error when activation code not found", async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(userService.activate(activationCode)).rejects.toThrow(
        "ACTIVATION_CODE_NOT_EXISTS"
      );
    });
  });
  
  describe("login method tests", () => {
    const email = "test@example.com";
    const password = "password123";
    const mockUser = {
      uid: "123e4567-e89b-12d3-a456-426614174000",
      passwd: "hashed_password",
      roles: ["REGISTERED"],
    };

    beforeEach(async () => {
      mockUuidBase64.encode.mockReturnValue("encoded_uid");
      mockJwtHelper.getAccessToken.mockResolvedValue("access_token");
      mockJwtHelper.getRefreshToken.mockResolvedValue("refresh_token");
    });

    it("should successfully login with correct credentials", async () => {
      mockPg._setMockResult([mockUser]);
      mockCryptoHelper.verifyPassword.mockResolvedValue(true);

      const result = await userService.login(email, password);

      expect(result).toEqual({
        user_id: "encoded_uid",
        access_token: "access_token",
        refresh_token: "refresh_token",
      });
      expect(mockCryptoHelper.verifyPassword).toHaveBeenCalledWith(
        password,
        mockUser.passwd
      );
    });

    it("should throw error when user not found", async () => {
      mockPg._setMockResult([]);

      await expect(userService.login(email, password)).rejects.toThrow(
        "USER_NOT_FOUND"
      );
    });

    it("should throw error when user is not active", async () => {
      mockPg._setMockResult([]); // User with status ACTIVE not found

      await expect(userService.login(email, password)).rejects.toThrow(
        "USER_NOT_FOUND"
      );
    });

    it("should throw unauthorized error when password doesn't match", async () => {
      mockPg._setMockResult([mockUser]);
      mockCryptoHelper.verifyPassword.mockResolvedValue(false);

      await expect(userService.login(email, password)).rejects.toThrow(
        "UNAUTHORIZED"
      );

      await expect(userService.login(email, password)).rejects.toMatchObject({
        status: 401,
        message: "UNAUTHORIZED",
      });
    });

    it("should handle database errors during login", async () => {
      const dbError = new Error("Database error");
      mockPg._setMockResult(dbError);

      await expect(userService.login(email, password)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("refreshToken method tests", () => {
    const user_id = "encoded_uid";
    const refreshToken = "refresh_token";
    const userUuid = "123e4567-e89b-12d3-a456-426614174000";
    const mockUserData = [
      {
        email: "test@example.com",
        roles: ["REGISTERED"],
      },
    ];

    beforeEach(() => {
      mockUuidBase64.decode.mockReturnValue(userUuid);
      mockJwtHelper.getAccessToken.mockResolvedValue("new_access_token");
      mockJwtHelper.getRefreshToken.mockResolvedValue("new_refresh_token");
    });

    it("should successfully refresh tokens", async () => {
      mockRedis.get.mockResolvedValue(null); // Not blacklisted
      mockPg._setMockResult(mockUserData);

      const result = await userService.refreshToken(user_id, refreshToken);

      expect(result).toEqual({
        user_id,
        access_token: "new_access_token",
        refresh_token: "new_refresh_token",
      });
      expect(mockRedis.get).toHaveBeenCalledWith(`blacklist_${refreshToken}`);
    });

    it("should throw error when token is blacklisted", async () => {
      mockRedis.get.mockResolvedValue("1"); // Blacklisted

      await expect(
        userService.refreshToken(user_id, refreshToken)
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(
        userService.refreshToken(user_id, refreshToken)
      ).rejects.toMatchObject({ status: 401, message: "UNAUTHORIZED" });
    });

    it("should throw error when user not found", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPg._setMockResult([]);

      await expect(
        userService.refreshToken(user_id, refreshToken)
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(
        userService.refreshToken(user_id, refreshToken)
      ).rejects.toMatchObject({ status: 401, message: "UNAUTHORIZED" });
    });

    it("should throw error when user is not active", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPg._setMockResult([]); // User with status ACTIVE not found

      await expect(
        userService.refreshToken(user_id, refreshToken)
      ).rejects.toThrow("UNAUTHORIZED");
    });
  });

  describe("get method tests", () => {
    const user_id = "encoded_uid";
    const userUuid = "123e4567-e89b-12d3-a456-426614174000";
    const mockUserData = [
      {
        login: "testuser",
        email: "test@example.com",
        name: "Test User",
        start_date: new Date("2024-01-01"),
        status: 1,
      },
    ];

    beforeEach(() => {
      mockUuidBase64.decode.mockReturnValue(userUuid);
    });

    it("should successfully get user data", async () => {
      mockPg._setMockResult(mockUserData);

      const result = await userService.get(user_id);

      expect(result).toEqual({
        user_id,
        login: mockUserData[0].login,
        email: mockUserData[0].email,
        name: mockUserData[0].name,
        start_date: mockUserData[0].start_date,
        status: mockUserData[0].status,
      });
    });

    it("should throw error when user not found", async () => {
      mockPg._setMockResult([]);

      await expect(userService.get(user_id)).rejects.toThrow("USER_NOT_FOUND");
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database error");
      mockPg._setMockResult(dbError);

      await expect(userService.get(user_id)).rejects.toThrow("Database error");
    });
  });

  describe("update method tests", () => {
    const user = {
      user_id: "encoded_uid",
      login: "updateduser",
      email: "updated@example.com",
      name: "Updated User",
    };
    const userUuid = "123e4567-e89b-12d3-a456-426614174000";
    const mockUserData = [
      {
        login: "updateduser",
        email: "updated@example.com",
        name: "Updated User",
        start_date: new Date("2024-01-01"),
        status: 1,
      },
    ];

    beforeEach(() => {
      mockUuidBase64.decode.mockReturnValue(userUuid);
    });

    it("should successfully update user", async () => {
      mockPg._setMockResult(mockUserData);

      const result = await userService.update(user);

      expect(result).toEqual(user);
      expect(mockPg).toHaveBeenCalledWith("account");
    });

    it("should throw error when user not found", async () => {
      mockPg._setMockResult([]);

      await expect(userService.update(user)).rejects.toThrow("USER_NOT_FOUND");
    });
  });

  describe("delete method tests", () => {
    const user_id = "encoded_uid";
    const userUuid = "123e4567-e89b-12d3-a456-426614174000";
    const mockUserData = [
      {
        login: "testuser",
        email: "test@example.com",
        name: "Test User",
        start_date: new Date("2024-01-01"),
        status: 1,
      },
    ];

    beforeEach(() => {
      mockUuidBase64.decode.mockReturnValue(userUuid);
    });

    it("should successfully delete user", async () => {
      mockPg._setMockResult(mockUserData);

      const result = await userService.delete(user_id);

      expect(result).toEqual({
        user_id,
        login: mockUserData[0].login,
        email: mockUserData[0].email,
        name: mockUserData[0].name,
        start_date: mockUserData[0].start_date,
        status: mockUserData[0].status,
      });
    });

    it("should throw error when user not found", async () => {
      mockPg._setMockResult([]);

      await expect(userService.delete(user_id)).rejects.toThrow(
        "USER_NOT_FOUND"
      );
    });
  });

  describe("logout method tests", () => {
    const accessToken = "test_access_token";
    const refreshToken = "test_refresh_token";
    const accessTtl = 3600;
    const refreshTtl = 86400;

    it("should blacklist both tokens in redis", async () => {
      await userService.logout(accessToken, accessTtl, refreshToken, refreshTtl);

      expect(mockRedis.setex).toHaveBeenCalledWith(`blacklist_${accessToken}`, accessTtl, 1);
      expect(mockRedis.setex).toHaveBeenCalledWith(`blacklist_${refreshToken}`, refreshTtl, 1);
      expect(mockRedis.setex).toHaveBeenCalledTimes(2);
    });

    it("should skip access token blacklist when accessTtl is 0 or negative", async () => {
      await userService.logout(accessToken, 0, refreshToken, refreshTtl);
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).toHaveBeenCalledWith(`blacklist_${refreshToken}`, refreshTtl, 1);
    });

    it("should skip refresh token blacklist when refreshTtl is 0 or negative", async () => {
      await userService.logout(accessToken, accessTtl, refreshToken, 0);
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).toHaveBeenCalledWith(`blacklist_${accessToken}`, accessTtl, 1);
    });

    it("should not blacklist any token when both ttls are 0 or negative", async () => {
      await userService.logout(accessToken, 0, refreshToken, -100);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it("should handle redis errors during logout", async () => {
      const redisError = new Error("Redis connection failed");
      mockRedis.setex.mockRejectedValue(redisError);

      await expect(userService.logout(accessToken, accessTtl, refreshToken, refreshTtl)).rejects.toThrow(
        "Redis connection failed"
      );
    });
  });

  describe("generateAccessToken and generateRefreshToken method tests", () => {
    it("should generate access token using jwtHelper", async () => {
      const user = { user_id: "123", email: "test@example.com" };
      mockJwtHelper.getAccessToken.mockResolvedValue("token123");

      const result = await userService.generateAccessToken(user);

      expect(result).toBe("token123");
      expect(mockJwtHelper.getAccessToken).toHaveBeenCalledWith(user);
    });

    it("should generate refresh token using jwtHelper", async () => {
      const obj = { user_id: "123" };
      mockJwtHelper.getRefreshToken.mockResolvedValue("refresh123");

      const result = await userService.generateRefreshToken(obj);

      expect(result).toBe("refresh123");
      expect(mockJwtHelper.getRefreshToken).toHaveBeenCalledWith(obj);
    });
  });
});

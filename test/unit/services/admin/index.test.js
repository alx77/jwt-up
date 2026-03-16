import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock(import("@/utils/KnexHelper.js"));

describe("@admin service tests", () => {
  let adminService;
  let mockPg;
  let mockUuidBase64;

  beforeEach(async () => {
    await vi.resetModules();

    const KnexHelper = await import("@/utils/KnexHelper.js");
    mockPg = KnexHelper.pg;

    vi.mock(import("@/utils/UuidBase64.js"), () => ({
      encode: vi.fn(),
      decode: vi.fn(),
    }));
    mockUuidBase64 = await import("@/utils/UuidBase64.js");

    const AdminServiceModule = await import("@/services/admin/index.js");
    adminService = AdminServiceModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("list method tests", () => {
    const mockRows = [
      {
        uid: "123e4567-e89b-12d3-a456-426614174000",
        login: "user1",
        email: "user1@example.com",
        name: "User One",
        start_date: new Date("2024-01-01"),
        status: 1,
      },
    ];

    beforeEach(() => {
      mockUuidBase64.encode.mockReturnValue("encoded_uid");
    });

    it("should return paginated list of accounts", async () => {
      mockPg.then
        .mockImplementationOnce(async (resolve) => resolve([{ count: "5" }]))
        .mockImplementationOnce(async (resolve) => resolve(mockRows));

      const result = await adminService.list({ page: 1, per_page: 20 });

      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.per_page).toBe(20);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].user_id).toBe("encoded_uid");
      expect(result.items[0].login).toBe("user1");
    });

    it("should apply status filter", async () => {
      mockPg.then
        .mockImplementationOnce(async (resolve) => resolve([{ count: "2" }]))
        .mockImplementationOnce(async (resolve) => resolve(mockRows));

      const result = await adminService.list({ page: 1, per_page: 20, status: 1 });

      expect(mockPg.where).toHaveBeenCalledWith({ status: 1 });
      expect(result.total).toBe(2);
    });

    it("should apply search filter", async () => {
      mockPg.then
        .mockImplementationOnce(async (resolve) => resolve([{ count: "1" }]))
        .mockImplementationOnce(async (resolve) => resolve(mockRows));

      await adminService.list({ page: 1, per_page: 20, q: "user" });

      expect(mockPg.where).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should calculate correct offset for page 2", async () => {
      mockPg.then
        .mockImplementationOnce(async (resolve) => resolve([{ count: "40" }]))
        .mockImplementationOnce(async (resolve) => resolve([]));

      await adminService.list({ page: 2, per_page: 20 });

      expect(mockPg.offset).toHaveBeenCalledWith(20);
      expect(mockPg.limit).toHaveBeenCalledWith(20);
    });

    it("should return empty items when no accounts found", async () => {
      mockPg.then
        .mockImplementationOnce(async (resolve) => resolve([{ count: "0" }]))
        .mockImplementationOnce(async (resolve) => resolve([]));

      const result = await adminService.list({ page: 1, per_page: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database error");
      mockPg._setMockResult(dbError);

      await expect(adminService.list({ page: 1, per_page: 20 })).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("get method tests", () => {
    const userUuid = "123e4567-e89b-12d3-a456-426614174000";
    const mockRow = {
      uid: userUuid,
      login: "user1",
      email: "user1@example.com",
      name: "User One",
      start_date: new Date("2024-01-01"),
      status: 1,
    };

    beforeEach(() => {
      mockUuidBase64.decode.mockReturnValue(userUuid);
    });

    it("should return user by id", async () => {
      mockPg._setMockResult([mockRow]);

      const result = await adminService.get("encoded_uid");

      expect(result).toMatchObject({
        user_id: "encoded_uid",
        login: "user1",
        email: "user1@example.com",
      });
      expect(mockUuidBase64.decode).toHaveBeenCalledWith("encoded_uid");
    });

    it("should throw 404 when user not found", async () => {
      mockPg._setMockResult([]);

      await expect(adminService.get("encoded_uid")).rejects.toMatchObject({
        status: 404,
        message: "USER_NOT_FOUND",
      });
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database error");
      mockPg._setMockResult(dbError);

      await expect(adminService.get("encoded_uid")).rejects.toThrow("Database error");
    });
  });

  describe("updateStatus method tests", () => {
    const userUuid = "123e4567-e89b-12d3-a456-426614174000";
    const mockRow = {
      login: "user1",
      email: "user1@example.com",
      name: "User One",
      start_date: new Date("2024-01-01"),
      status: 2,
    };

    beforeEach(() => {
      mockUuidBase64.decode.mockReturnValue(userUuid);
    });

    it("should update account status", async () => {
      mockPg._setMockResult([mockRow]);

      const result = await adminService.updateStatus("encoded_uid", 2);

      expect(result.status).toBe(2);
      expect(mockPg.update).toHaveBeenCalledWith({ status: 2 });
    });

    it("should throw 404 when user not found", async () => {
      mockPg._setMockResult([]);

      await expect(adminService.updateStatus("encoded_uid", 2)).rejects.toMatchObject({
        status: 404,
        message: "USER_NOT_FOUND",
      });
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database error");
      mockPg._setMockResult(dbError);

      await expect(adminService.updateStatus("encoded_uid", 2)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("delete method tests", () => {
    const userUuid = "123e4567-e89b-12d3-a456-426614174000";

    beforeEach(() => {
      mockUuidBase64.decode.mockReturnValue(userUuid);
    });

    it("should delete account successfully", async () => {
      mockPg._setMockResult([{ id: 1 }]);

      await expect(adminService.delete("encoded_uid")).resolves.toBeUndefined();
      expect(mockPg.delete).toHaveBeenCalled();
    });

    it("should throw 404 when user not found", async () => {
      mockPg._setMockResult([]);

      await expect(adminService.delete("encoded_uid")).rejects.toMatchObject({
        status: 404,
        message: "USER_NOT_FOUND",
      });
    });

    it("should handle database errors", async () => {
      const dbError = new Error("Database error");
      mockPg._setMockResult(dbError);

      await expect(adminService.delete("encoded_uid")).rejects.toThrow("Database error");
    });
  });
});

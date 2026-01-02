import { describe, it, expect } from "vitest";
import { encode, decode } from "@/utils/UuidBase64.js";

describe("@utils - UuidBase64 Conversion tests", () => {
  describe("encode/decode roundtrip", () => {
    const testCases = [
      {
        name: "standard UUID",
        uuid: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      },
      {
        name: "null UUID",
        uuid: "00000000-0000-0000-0000-000000000000",
      },
      {
        name: "max UUID",
        uuid: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      },
      {
        name: "example UUID",
        uuid: "550e8400-e29b-41d4-a716-446655440000",
      },
    ];

    it.each(testCases)("should roundtrip correctly", ({ uuid }) => {
      const encoded = encode(uuid);
      const decoded = decode(encoded);
      expect(decoded).toBe(uuid);
    });
  });

  describe("specific encodings", () => {
    it("should encode UUID to expected short string", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const expected = "VQ6EAOKbQdSnFkRmVUQAAA";
      expect(encode(uuid)).toBe(expected);
    });
  });

  describe("input format handling", () => {
    const base64String = "VQ6EAC4pQdSnFkRmVVQAAA";

    it("should handle padding variations", () => {
      const uuid1 = decode(base64String);
      const uuid2 = decode(base64String + "==");
      expect(uuid1).toBe(uuid2);
    });

    it("should trim whitespace", () => {
      const uuid1 = decode(base64String);
      const uuid2 = decode("  " + base64String + "  ");
      expect(uuid1).toBe(uuid2);
    });
  });
});

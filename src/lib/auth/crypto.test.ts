import { describe, expect, it, vi } from "vitest";
import { generateApiKey } from "@/lib/api/auth";
import { generateToken, hashPassword, sha256, verifyPassword } from "./crypto";

// api/auth.ts pulls in the DB client and next/server; stub them so the pure key generator can load.
// vi.mock is hoisted above the imports.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ after: () => {} }));

describe("hashPassword / verifyPassword", () => {
  it("verifies the correct password", async () => {
    const stored = await hashPassword("geheim-123");
    expect(await verifyPassword("geheim-123", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("geheim-123");
    expect(await verifyPassword("geheim-124", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("uses a fresh salt per hash", async () => {
    const a = await hashPassword("gleich");
    const b = await hashPassword("gleich");
    expect(a).not.toBe(b);
    expect(a.split("$")[4]).not.toBe(b.split("$")[4]);
    expect(await verifyPassword("gleich", a)).toBe(true);
    expect(await verifyPassword("gleich", b)).toBe(true);
  });

  it("stores the scrypt$N$r$p$salt$hash format", async () => {
    const parts = (await hashPassword("x")).split("$");
    expect(parts).toHaveLength(6);
    expect(parts.slice(0, 4)).toEqual(["scrypt", "16384", "8", "1"]);
  });

  it("returns false for malformed or foreign stored values", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
    expect(await verifyPassword("x", "scrypt$16384$8$1$")).toBe(false);
  });
});

describe("generateApiKey", () => {
  it("matches the ktr_ + 32 hex format", () => {
    const { key } = generateApiKey();
    expect(key).toMatch(/^ktr_[0-9a-f]{32}$/);
  });

  it("derives keyPrefix and keyHash consistently", () => {
    const { key, keyPrefix, keyHash } = generateApiKey();
    expect(keyPrefix).toBe(key.slice(0, 10));
    expect(keyHash).toBe(sha256(key));
  });

  it("generates distinct keys", () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key);
  });
});

describe("sha256", () => {
  it("is consistent and hex-encoded", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256("abc")).toBe(sha256("abc"));
  });
});

describe("generateToken", () => {
  it("returns a 256-bit base64url token", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toBe(generateToken());
  });
});

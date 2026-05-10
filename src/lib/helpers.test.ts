import { describe, expect, it } from "vitest";
import {
  normalizeCommentBody,
  validateCommentBody,
} from "@/lib/activity-social";
import { friendshipKeyPair, publicLabel } from "@/lib/friends";
import { normalizeHandleInput, validateHandle } from "@/lib/handle";

import { sniffAvatarMime, validateAvatarFile } from "@/lib/avatar";

describe("avatar", () => {
  it("sniffs jpeg and png", () => {
    expect(sniffAvatarMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg",
    );
    expect(
      sniffAvatarMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])),
    ).toBe("image/png");
  });

  it("validateAvatarFile rejects tiny buffer", () => {
    expect(validateAvatarFile(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("handle", () => {
  it("normalizes @ and case", () => {
    expect(normalizeHandleInput("  @Alex_CODE  ")).toBe("alex_code");
  });

  it("validates length and charset", () => {
    expect(validateHandle("ab")).toMatch(/3–30/);
    expect(validateHandle("Bad!")).toMatch(/lowercase/);
    expect(validateHandle("good_h1")).toBeNull();
  });
});

describe("activity-social", () => {
  it("normalizeCommentBody trims and caps", () => {
    expect(normalizeCommentBody("  hi  ")).toBe("hi");
    const long = "x".repeat(600);
    expect(normalizeCommentBody(long).length).toBe(500);
  });

  it("validateCommentBody rejects empty", () => {
    expect(validateCommentBody("   ")).toMatch(/empty/i);
    expect(validateCommentBody("ok")).toBeNull();
  });
});

describe("friends", () => {
  it("friendshipKeyPair orders lexicographically", () => {
    expect(friendshipKeyPair("b", "a")).toEqual(["a", "b"]);
    expect(friendshipKeyPair("a", "a")).toEqual(["a", "a"]);
  });

  it("publicLabel prefers display name", () => {
    expect(
      publicLabel({
        id: "1",
        displayName: " Pat ",
        handle: "pat",
        avatarBytes: null,
      }),
    ).toBe("Pat");
    expect(
      publicLabel({ id: "1", displayName: null, handle: "pat", avatarBytes: null }),
    ).toBe("@pat");
  });
});

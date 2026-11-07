import { describe, expect, it } from "vitest";
import { containsPrivateKey, isInsideDirectory } from "./publishable-text.ts";

describe("containsPrivateKey", () => {
  it.each([
    "-----BEGIN RSA PRIVATE KEY-----",
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN ENCRYPTED PRIVATE KEY-----",
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    "Notes\n\n-----BEGIN EC PRIVATE KEY-----\nMHcC",
  ])("recognises %s anywhere in the text", (text) => {
    expect(containsPrivateKey(text)).toBe(true);
  });

  it.each(["## Summary\n\nRotates the private key.", "-----BEGIN PUBLIC KEY-----"])(
    "lets %s through",
    (text) => {
      expect(containsPrivateKey(text)).toBe(false);
    },
  );
});

describe("isInsideDirectory", () => {
  const directory = "C:\\Users\\helen\\.config\\rin-github-apps";

  it.each([
    "C:/Users/helen/.config/rin-github-apps/credentials.json",
    "c:\\users\\helen\\.config\\rin-github-apps\\keys\\author.pem",
    "C:/Users/helen/.config/rin-github-apps",
  ])("places %s inside the directory", (path) => {
    expect(isInsideDirectory({ path, directory })).toBe(true);
  });

  it.each([
    "C:/Users/helen/.config/rin-github-apps-notes/body.md",
    "C:/Users/helen/.config/body.md",
  ])("places %s outside the directory", (path) => {
    expect(isInsideDirectory({ path, directory })).toBe(false);
  });
});

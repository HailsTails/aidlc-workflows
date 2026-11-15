import { describe, expect, it } from "vitest";
import { assessPublishability, isInsideDirectory } from "./publishable-text.ts";

const USER_ACCESS_TOKEN = `ghu_${"a".repeat(36)}`;

const REFRESH_TOKEN = `ghr_${"b".repeat(36)}`;

const OAUTH_ACCESS_TOKEN = `gho_${"c".repeat(36)}`;

const INSTALLATION_TOKEN = `ghs_${"d".repeat(36)}`;

const PERSONAL_TOKEN = `ghp_${"e".repeat(36)}`;

const FINE_GRAINED_TOKEN = `github_pat_${"f".repeat(22)}_${"g".repeat(59)}`;

describe("assessPublishability", () => {
  it.each([
    "-----BEGIN RSA PRIVATE KEY-----",
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN ENCRYPTED PRIVATE KEY-----",
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    "Notes\n\n-----BEGIN EC PRIVATE KEY-----\nMHcC",
  ])("finds a private key in %s anywhere in the text", (text) => {
    expect(assessPublishability(text)).toBe("contains-private-key");
  });

  it.each([
    USER_ACCESS_TOKEN,
    REFRESH_TOKEN,
    OAUTH_ACCESS_TOKEN,
    INSTALLATION_TOKEN,
    PERSONAL_TOKEN,
    FINE_GRAINED_TOKEN,
    `Token: ${USER_ACCESS_TOKEN} was pasted`,
    `ghu_${"A1".repeat(10)}`,
    `ghr_${"c".repeat(20)}`,
  ])("finds a GitHub token in %s", (text) => {
    expect(assessPublishability(text)).toBe("contains-github-token");
  });

  it("reports the private key when a GitHub token is present too", () => {
    expect(assessPublishability(`${USER_ACCESS_TOKEN}\n-----BEGIN PRIVATE KEY-----`)).toBe(
      "contains-private-key",
    );
  });

  it.each([
    "## Summary\n\nRotates the private key.",
    "-----BEGIN PUBLIC KEY-----",
    "Uses a `ghu_` token for uploads.",
    "ghu_ and ghr_ are the prefixes",
    "the grant is a `gho_` token",
    "a github_pat_ or ghs_ prefix alone",
    `ghu_${"a".repeat(19)}`,
    `ghr_${"a".repeat(19)}-tail`,
  ])("lets %s through", (text) => {
    expect(assessPublishability(text)).toBe("publishable");
  });
});

describe("isInsideDirectory", () => {
  const directory = "C:\\Users\\operator\\.config\\rin-github-apps";

  it.each([
    "C:/Users/operator/.config/rin-github-apps/credentials.json",
    "c:\\users\\operator\\.config\\rin-github-apps\\keys\\author.pem",
    "C:/Users/operator/.config/rin-github-apps",
  ])("places %s inside the directory", (path) => {
    expect(isInsideDirectory({ path, directory })).toBe(true);
  });

  it.each([
    "C:/Users/operator/.config/rin-github-apps-notes/body.md",
    "C:/Users/operator/.config/body.md",
  ])("places %s outside the directory", (path) => {
    expect(isInsideDirectory({ path, directory })).toBe(false);
  });
});

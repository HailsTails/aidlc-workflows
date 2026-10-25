import { describe, expect, it } from "vitest";
import { formatRepositorySlug, matchRemoteUrl, matchRepositoryPath } from "./repository-slug.ts";

const minutesarahShop = { owner: "HailsTails", name: "minutesarah-shop" };

describe("formatRepositorySlug", () => {
  it("joins owner and name the way the GitHub REST paths expect", () => {
    expect(formatRepositorySlug(minutesarahShop)).toBe("HailsTails/minutesarah-shop");
  });
});

describe("matchRepositoryPath", () => {
  it("matches the git remote path of the configured repository", () => {
    expect(
      matchRepositoryPath({
        repository: minutesarahShop,
        requestedPath: "HailsTails/minutesarah-shop.git",
      }),
    ).toBe("same-repository");
  });

  it("ignores case because GitHub repository names are case-insensitive", () => {
    expect(
      matchRepositoryPath({
        repository: minutesarahShop,
        requestedPath: "hailstails/MinuteSarah-Shop",
      }),
    ).toBe("same-repository");
  });

  it("refuses any other repository", () => {
    expect(
      matchRepositoryPath({ repository: minutesarahShop, requestedPath: "HailsTails/rin.git" }),
    ).toBe("other-repository");
  });
});

describe("matchRemoteUrl", () => {
  it.each([
    "https://github.com/HailsTails/minutesarah-shop.git",
    "https://github.com/hailstails/minutesarah-shop",
    "https://github.com/HailsTails/minutesarah-shop/",
  ])("recognises %s as the configured repository", (remoteUrl) => {
    expect(matchRemoteUrl({ repository: minutesarahShop, remoteUrl })).toBe("same-repository");
  });

  it.each([
    "https://github.com/HailsTails/rin.git",
    "https://github.com/someone-else/minutesarah-shop.git",
  ])("treats %s as another repository", (remoteUrl) => {
    expect(matchRemoteUrl({ repository: minutesarahShop, remoteUrl })).toBe("other-repository");
  });

  it.each([
    "git@github.com:HailsTails/minutesarah-shop.git",
    "ssh://git@github.com/HailsTails/minutesarah-shop.git",
    "https://x-access-token@github.com/HailsTails/minutesarah-shop.git",
    "http://github.com/HailsTails/minutesarah-shop.git",
    "https://gitlab.com/HailsTails/minutesarah-shop.git",
    "https://github.com.evil.example/HailsTails/minutesarah-shop.git",
    "https://github.com/HailsTails/minutesarah-shop/extra.git",
    "H:/Development/minutesarah-shop",
    "",
  ])("refuses %s because the credential helper only serves https://github.com/", (remoteUrl) => {
    expect(matchRemoteUrl({ repository: minutesarahShop, remoteUrl })).toBe("not-github-https");
  });
});

import { describe, expect, it } from "vitest";
import { formatRepositorySlug, matchRepositoryPath } from "./repository-slug.ts";

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

import { assert, describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { loadIdentityConfiguration } from "./identity-configuration.ts";
import type { TextFileReader } from "./text-file-reader.ts";

const location = new URL("file:///H:/shop/aidlc/github-identity.json");

const reading = (configurationText: string) =>
  vi.fn<TextFileReader>().mockResolvedValue(succeed(configurationText));

describe("loadIdentityConfiguration", () => {
  it("reads the target repository, base branch and each role's app", async () => {
    const readTextFile = reading(
      '{"repository":"HailsTails/minutesarah-shop","baseBranch":"main","roles":{"author":{"appSlug":"rin-author"},"reviewer":{"appSlug":"rin-reviewer"}}}',
    );

    expect(await loadIdentityConfiguration({ readTextFile, location })).toEqual(
      succeed({
        repository: { owner: "HailsTails", name: "minutesarah-shop" },
        baseBranch: "main",
        roles: { author: { appSlug: "rin-author" }, reviewer: { appSlug: "rin-reviewer" } },
      }),
    );
  });

  it("refuses a repository that is not owner/name", async () => {
    const readTextFile = reading(
      '{"repository":"minutesarah-shop","baseBranch":"main","roles":{"author":{"appSlug":"a"},"reviewer":{"appSlug":"r"}}}',
    );

    const configuration = await loadIdentityConfiguration({ readTextFile, location });

    assert(
      configuration.kind === "failure" && configuration.reason.kind === "configuration-invalid",
    );
    expect(configuration.reason.issues).toContain("repository");
  });

  it("reports a configuration it cannot read", async () => {
    const readTextFile = vi
      .fn<TextFileReader>()
      .mockResolvedValue(fail({ kind: "file-unreadable", location: location.href }));

    expect(await loadIdentityConfiguration({ readTextFile, location })).toEqual(
      fail({ kind: "configuration-unreadable", location: location.href }),
    );
  });
});

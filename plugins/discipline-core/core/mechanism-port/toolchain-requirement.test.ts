import { describe, expect, it, vi } from "vitest";
import { loadedPeer, supportedRange, type ToolchainRequirement, versionSupport } from "./toolchain-requirement.ts";

const TWO_MAJORS: ToolchainRequirement = {
  packageName: "eslint",
  lines: [
    { floor: "9.39.5", stays: "within-major" },
    { floor: "10.11.0", stays: "within-major" },
  ],
};

const ONE_MINOR: ToolchainRequirement = {
  packageName: "typescript",
  lines: [{ floor: "6.0.3", stays: "within-minor" }],
};

const missingPackage = (request: { readonly packageName: string }): Error =>
  Object.assign(new Error(`Cannot find package '${request.packageName}' imported from /repo/tools/discipline-core/x.ts`), {
    code: "ERR_MODULE_NOT_FOUND",
  });

const unreadableVersion = (): string => {
  throw new Error("no version export");
};

describe("supportedRange", () => {
  it("renders a major line with a caret and a minor line with a tilde, alternatives joined as npm writes them", () => {
    expect({
      twoMajors: supportedRange({ requirement: TWO_MAJORS }),
      oneMinor: supportedRange({ requirement: ONE_MINOR }),
    }).toEqual({ twoMajors: "^9.39.5 || ^10.11.0", oneMinor: "~6.0.3" });
  });
});

describe("versionSupport", () => {
  it.each([
    { version: "9.39.5", support: "supported" },
    { version: "9.40.0", support: "supported" },
    { version: "10.11.0", support: "supported" },
    { version: "10.12.0-rc.0", support: "supported" },
    { version: "9.39.4", support: "unsupported" },
    { version: "10.10.9", support: "unsupported" },
    { version: "8.57.1", support: "unsupported" },
    { version: "11.0.0", support: "unsupported" },
    { version: "not-a-version", support: "unsupported" },
  ])("reads $version as $support against ^9.39.5 || ^10.11.0", ({ version, support }) => {
    expect(versionSupport({ requirement: TWO_MAJORS, version })).toBe(support);
  });

  it.each([
    { version: "6.0.3", support: "supported" },
    { version: "6.0.9", support: "supported" },
    { version: "6.1.0", support: "unsupported" },
    { version: "5.9.3", support: "unsupported" },
  ])("reads $version as $support against ~6.0.3", ({ version, support }) => {
    expect(versionSupport({ requirement: ONE_MINOR, version })).toBe(support);
  });
});

describe("loadedPeer", () => {
  it("hands back the module when its version is supported", async () => {
    const loaded = { version: "10.11.0" };
    await expect(
      loadedPeer({ requirement: TWO_MAJORS, load: () => Promise.resolve(loaded), versionOf: (peer) => peer.version }),
    ).resolves.toEqual({ outcome: "ok", value: loaded });
  });

  it("names the package as not installed when it does not resolve", async () => {
    await expect(
      loadedPeer({
        requirement: TWO_MAJORS,
        load: () => Promise.reject(missingPackage({ packageName: "eslint" })),
        versionOf: () => "unread",
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName: "eslint", supported: "^9.39.5 || ^10.11.0", found: "not installed" },
    });
  });

  it("names the installed version when it is outside the supported range", async () => {
    await expect(
      loadedPeer({ requirement: TWO_MAJORS, load: () => Promise.resolve({ version: "8.57.1" }), versionOf: (peer) => peer.version }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName: "eslint", supported: "^9.39.5 || ^10.11.0", found: "8.57.1" },
    });
  });

  it("names the package unloadable with the loader's message when it resolves but fails to load, including a missing package of its own", async () => {
    await expect(
      loadedPeer({
        requirement: TWO_MAJORS,
        load: () => Promise.reject(missingPackage({ packageName: "espree" })),
        versionOf: () => "unread",
      }),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", found: expect.stringMatching(/^unloadable: Cannot find package 'espree'/) },
    });
  });

  it("names the package unloadable when its version cannot be read", async () => {
    await expect(
      loadedPeer({
        requirement: TWO_MAJORS,
        load: () => Promise.resolve({}),
        versionOf: vi.fn<(peer: object) => string>().mockImplementation(unreadableVersion),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { found: "unloadable: no version export" } });
  });
});

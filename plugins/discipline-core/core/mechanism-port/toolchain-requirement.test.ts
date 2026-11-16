import { describe, expect, it, vi } from "vitest";
import { loadedPeer, supportedRange, type ToolchainRequirement, versionSupport } from "./toolchain-requirement.ts";

const TWO_MAJORS: ToolchainRequirement = {
  packageName: "eslint",
  lines: [
    { floor: "9.12.0", below: "10.0.0" },
    { floor: "10.0.0", below: "11.0.0" },
  ],
};

const SPAN: ToolchainRequirement = {
  packageName: "typescript",
  lines: [{ floor: "4.8.4", below: "7.0.0" }],
};

const INSTALL_ROOT = "/repo/tools/discipline-core";

const REPOSITORY_LOCATION = "/repo/node_modules/eslint/lib/api.js";

const missingPackage = (request: { readonly packageName: string }): Error =>
  Object.assign(new Error(`Cannot find package '${request.packageName}' imported from ${INSTALL_ROOT}/x.ts`), {
    code: "ERR_MODULE_NOT_FOUND",
  });


const peerAt = (request: { readonly version: string; readonly location?: string }) => ({
  requirement: TWO_MAJORS,
  location: { installRoot: INSTALL_ROOT, locate: () => request.location ?? REPOSITORY_LOCATION },
  load: () => Promise.resolve({ version: request.version }),
  versionOf: (peer: { readonly version: string }) => peer.version,
});

describe("supportedRange", () => {
  it("renders a line that spans one major with a caret, and any other line as a floor and a bound, joined as npm writes alternatives", () => {
    expect({
      twoMajors: supportedRange({ requirement: TWO_MAJORS }),
      span: supportedRange({ requirement: SPAN }),
    }).toEqual({ twoMajors: "^9.12.0 || ^10.0.0", span: ">=4.8.4 <7.0.0" });
  });
});

describe("versionSupport", () => {
  it.each([
    { version: "9.12.0", support: "supported" },
    { version: "9.39.5", support: "supported" },
    { version: "10.0.0", support: "supported" },
    { version: "10.11.0", support: "supported" },
    { version: "9.11.1", support: "unsupported" },
    { version: "8.57.1", support: "unsupported" },
    { version: "11.0.0", support: "unsupported" },
    { version: "not-a-version", support: "unsupported" },
  ])("reads $version as $support against ^9.12.0 || ^10.0.0", ({ version, support }) => {
    expect(versionSupport({ requirement: TWO_MAJORS, version })).toBe(support);
  });

  it.each([
    { version: "4.8.4", support: "supported" },
    { version: "5.9.3", support: "supported" },
    { version: "6.1.2", support: "supported" },
    { version: "4.8.3", support: "unsupported" },
    { version: "7.0.0", support: "unsupported" },
  ])("reads $version as $support against >=4.8.4 <7.0.0", ({ version, support }) => {
    expect(versionSupport({ requirement: SPAN, version })).toBe(support);
  });

  it.each(["10.12.0-rc.0", "11.0.0-alpha.1", "9.12.0-beta"])(
    "reads the prerelease %s as unsupported, as npm's ranges leave prereleases out",
    (version) => {
      expect(versionSupport({ requirement: TWO_MAJORS, version })).toBe("unsupported");
    },
  );
});

describe("loadedPeer", () => {
  it("hands back the module when it resolves outside the install and its version is supported", async () => {
    await expect(loadedPeer(peerAt({ version: "10.11.0" }))).resolves.toEqual({ outcome: "ok", value: { version: "10.11.0" } });
  });

  it("names the package as not installed when it does not resolve", async () => {
    await expect(loadedPeer({ ...peerAt({ version: "10.11.0" }), location: { installRoot: INSTALL_ROOT, locate: vi.fn<() => string>().mockThrow(missingPackage({ packageName: "eslint" })) } })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName: "eslint", supported: "^9.12.0 || ^10.0.0", found: "not installed" },
    });
  });

  it("names the package as shadowed, with where it resolved, when it resolves from inside the core install, and never loads it", async () => {
    const load = vi.fn<() => Promise<{ readonly version: string }>>();
    await expect(
      loadedPeer({
        ...peerAt({ version: "10.11.0", location: `${INSTALL_ROOT}/node_modules/eslint/lib/api.js` }),
        load,
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "toolchain-shadowed",
        packageName: "eslint",
        location: `${INSTALL_ROOT}/node_modules/eslint/lib/api.js`,
        installRoot: INSTALL_ROOT,
      },
    });
    expect(load).not.toHaveBeenCalled();
  });

  it("reads Windows separators when deciding the package resolves from inside the install", async () => {
    await expect(
      loadedPeer({
        ...peerAt({ version: "10.11.0" }),
        location: {
          installRoot: "C:\\repo\\tools\\discipline-core",
          locate: () => "C:\\repo\\tools\\discipline-core\\node_modules\\eslint\\lib\\api.js",
        },
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "toolchain-shadowed" } });
  });

  it("does not take a sibling folder sharing the install's name as a prefix for the install", async () => {
    await expect(
      loadedPeer(peerAt({ version: "10.11.0", location: "/repo/tools/discipline-core-old/node_modules/eslint/lib/api.js" })),
    ).resolves.toMatchObject({ outcome: "ok" });
  });

  it("names the installed version when it is outside the supported range", async () => {
    await expect(loadedPeer(peerAt({ version: "8.57.1" }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName: "eslint", supported: "^9.12.0 || ^10.0.0", found: "8.57.1" },
    });
  });

  it("names the package unloadable with the loader's message when it resolves but fails to load, including a missing package of its own", async () => {
    await expect(
      loadedPeer({ ...peerAt({ version: "10.11.0" }), load: () => Promise.reject(missingPackage({ packageName: "espree" })) }),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", found: expect.stringMatching(/^unloadable: Cannot find package 'espree'/) },
    });
  });

  it("names the package unloadable when its version cannot be read", async () => {
    await expect(
      loadedPeer({ ...peerAt({ version: "10.11.0" }), versionOf: vi.fn<(peer: object) => string>().mockThrow(new Error("no version export")) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { found: "unloadable: no version export" } });
  });
});

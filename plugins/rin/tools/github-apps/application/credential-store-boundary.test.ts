import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { createStorePlacementCheck } from "./credential-store-boundary.ts";
import type { StoreLocator } from "./credential-store-port.ts";
import type { CanonicalPathResolver } from "./text-file-port.ts";

const storeDirectory = "C:/Users/helen/.config/rin-github-apps";

const locatedStore = () => vi.fn<StoreLocator>().mockReturnValue(succeed(storeDirectory));

describe("createStorePlacementCheck", () => {
  it("places a file outside the store at its canonical path", async () => {
    const resolveCanonicalPath = vi
      .fn<CanonicalPathResolver>()
      .mockResolvedValueOnce(succeed("H:/shop/a.png"))
      .mockResolvedValueOnce(succeed(storeDirectory));
    const placeInStore = createStorePlacementCheck({ resolveCanonicalPath, locateCredentialStore: locatedStore() });

    expect(await placeInStore("a.png")).toEqual({ kind: "outside-store", canonicalPath: "H:/shop/a.png" });
  });

  it("places a path that resolves into the store inside it", async () => {
    const resolveCanonicalPath = vi
      .fn<CanonicalPathResolver>()
      .mockResolvedValueOnce(succeed(`${storeDirectory}/credentials.json`))
      .mockResolvedValueOnce(succeed(storeDirectory));
    const placeInStore = createStorePlacementCheck({ resolveCanonicalPath, locateCredentialStore: locatedStore() });

    expect(await placeInStore("link.json")).toEqual({ kind: "inside-store" });
  });

  it("places a path inside a store reached through a link", async () => {
    const resolveCanonicalPath = vi
      .fn<CanonicalPathResolver>()
      .mockResolvedValueOnce(succeed("D:/real-store/credentials.json"))
      .mockResolvedValueOnce(succeed("D:/real-store"));
    const placeInStore = createStorePlacementCheck({ resolveCanonicalPath, locateCredentialStore: locatedStore() });

    expect(await placeInStore("credentials.json")).toEqual({ kind: "inside-store" });
  });

  it("reports a path that does not resolve", async () => {
    const resolveCanonicalPath = vi
      .fn<CanonicalPathResolver>()
      .mockResolvedValue(fail({ kind: "file-unreadable", location: "absent.png" }));
    const placeInStore = createStorePlacementCheck({ resolveCanonicalPath, locateCredentialStore: locatedStore() });

    expect(await placeInStore("absent.png")).toEqual({ kind: "unresolvable" });
  });

  it("treats a file as outside when the store cannot be located", async () => {
    const resolveCanonicalPath = vi.fn<CanonicalPathResolver>().mockResolvedValue(succeed("H:/shop/a.png"));
    const placeInStore = createStorePlacementCheck({
      resolveCanonicalPath,
      locateCredentialStore: vi.fn<StoreLocator>().mockReturnValue(fail({ detail: "no home" })),
    });

    expect(await placeInStore("a.png")).toEqual({ kind: "outside-store", canonicalPath: "H:/shop/a.png" });
  });
});

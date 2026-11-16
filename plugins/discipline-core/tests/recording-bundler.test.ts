import { describe, expect, it } from "vitest";
import type { Bundle, BundleRequest } from "../scripts/esbuild-bundler-port.ts";
import { inMemoryFiles } from "./in-memory-files.ts";
import { recordingBundler } from "./recording-bundler.ts";

const BUNDLE: Bundle = { outputs: [], packageRoots: [] };

const REQUEST: BundleRequest = { sourceRoot: "/stage", entryPoints: ["core/a.ts"], external: [], target: "node22" };

describe("recordingBundler", () => {
  it("returns the given bundle, recording each request and what the stage held when it was bundled", async () => {
    const files = inMemoryFiles({ initial: { "/stage/core/a.ts": "a", "/other/b.ts": "b" } });
    const recording = recordingBundler({ files, stage: "/stage", bundle: { outcome: "ok", value: BUNDLE } });

    const bundled = await recording.bundler.bundle(REQUEST);
    files.scratch.removeTree({ path: "/stage" });

    expect({ bundled, requests: recording.requests(), staged: recording.stagedWhenBundled() }).toEqual({
      bundled: { outcome: "ok", value: BUNDLE },
      requests: [REQUEST],
      staged: ["core/a.ts"],
    });
  });

  it("records nothing before it is asked to bundle", () => {
    const recording = recordingBundler({ files: inMemoryFiles({ initial: {} }), stage: "/stage", bundle: { outcome: "ok", value: BUNDLE } });

    expect({ requests: recording.requests(), staged: recording.stagedWhenBundled() }).toEqual({ requests: [], staged: [] });
  });
});

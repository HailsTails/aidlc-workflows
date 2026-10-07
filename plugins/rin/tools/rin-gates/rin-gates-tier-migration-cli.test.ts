import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type {
  Clock,
  FileSystemCapabilities,
  RecordStore,
} from "./rin-gates-record-store.ts";
import {
  type Output,
  resolveIntentsRoot,
  resolveRatifiedMilestones,
  run,
} from "./rin-gates-tier-migration-cli.ts";

const pinnedClock: Clock = { nowUtc: () => new Date("2026-09-02T08:00:00Z") };

// Paths are composed with `join` rather than written as literals so the
// fixtures describe the same directories on every platform's separator.
const CHECKOUT_ROOT = join("/repo");
const CHECKOUT_MARKER_PATH = join(CHECKOUT_ROOT, ".git");
const INTENTS_ROOT = join(
  CHECKOUT_ROOT,
  "aidlc",
  "spaces",
  "default",
  "intents",
);
const AUTHORED_DEPTH = join(
  CHECKOUT_ROOT,
  "plugins",
  "rin",
  "tools",
  "rin-gates",
);
const COMPOSED_DEPTH = join(CHECKOUT_ROOT, ".claude", "tools", "rin-gates");
const OUTSIDE_ANY_CHECKOUT = join("/elsewhere", "tools");

const VALID_SELECTION_CONFIG = JSON.stringify({
  ratifiedMilestones: ["M1", "M2"],
  neglectThresholdDays: 30,
});

const fileSystemWith = (
  presentDirs: readonly string[],
  selectionConfigRaw: string = VALID_SELECTION_CONFIG,
): FileSystemCapabilities => ({
  readFile: () => selectionConfigRaw,
  writeFile: () => undefined,
  readDirectoryNames: () => [],
  directoryExists: ({ path }) => presentDirs.includes(path),
});

const emptyStore: RecordStore = {
  readBinding: () => ({ outcome: "ok", value: null }),
  writeBinding: () => ({ outcome: "ok", value: undefined }),
  listRecordDirs: () => ({ outcome: "ok", value: [] }),
};

const refusingStore: RecordStore = {
  readBinding: () => ({ outcome: "ok", value: null }),
  writeBinding: () => ({ outcome: "ok", value: undefined }),
  listRecordDirs: () => ({
    outcome: "failed",
    error: { kind: "read-failed", path: "/repo/intents", detail: "EACCES" },
  }),
};

const recordingOutput = (): Output & {
  readonly out: string[];
  readonly err: string[];
} => {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    writeOut: ({ line }) => {
      out.push(line);
    },
    writeError: ({ line }) => {
      err.push(line);
    },
  };
};

// The checkout root is four segments above the authored copy and three above
// the composed one, so these cases pin the property that the resolution is
// marker-driven rather than depth-driven: the SAME walk finds the same root
// from either depth.
describe("resolveIntentsRoot", () => {
  test("finds the checkout root by its marker from the authored plugin depth", () => {
    expect(
      resolveIntentsRoot({
        from: AUTHORED_DEPTH,
        fileSystem: fileSystemWith([CHECKOUT_MARKER_PATH, INTENTS_ROOT]),
      }),
    ).toEqual({
      kind: "resolved",
      intentsRoot: INTENTS_ROOT,
    });
  });

  test("finds the same root from the shallower composed depth", () => {
    expect(
      resolveIntentsRoot({
        from: COMPOSED_DEPTH,
        fileSystem: fileSystemWith([CHECKOUT_MARKER_PATH, INTENTS_ROOT]),
      }),
    ).toEqual({
      kind: "resolved",
      intentsRoot: INTENTS_ROOT,
    });
  });

  test("reports an absent intents root rather than letting it read as an empty corpus", () => {
    expect(
      resolveIntentsRoot({
        from: AUTHORED_DEPTH,
        fileSystem: fileSystemWith([CHECKOUT_MARKER_PATH]),
      }),
    ).toEqual({
      kind: "intents-root-absent",
      expected: INTENTS_ROOT,
    });
  });

  test("reports that no checkout root exists rather than walking past the filesystem root", () => {
    expect(
      resolveIntentsRoot({
        from: OUTSIDE_ANY_CHECKOUT,
        fileSystem: fileSystemWith([]),
      }),
    ).toEqual({ kind: "no-checkout-root", from: OUTSIDE_ANY_CHECKOUT });
  });
});

describe("run", () => {
  test("renders the summary and exits zero when the corpus resolves", () => {
    const output = recordingOutput();

    const code = run({
      argv: [],
      from: AUTHORED_DEPTH,
      fileSystem: fileSystemWith([CHECKOUT_MARKER_PATH, INTENTS_ROOT]),
      derivations: emptyStore,
      bindings: emptyStore,
      clock: pinnedClock,
      output,
    });

    expect(code).toBe(0);
    expect(output.err).toEqual([]);
    expect(output.out).toHaveLength(1);
    expect(output.out[0]).toContain("migrated 0");
  });

  test("emits JSON instead of the summary when --json is passed", () => {
    const output = recordingOutput();

    run({
      argv: ["--json"],
      from: AUTHORED_DEPTH,
      fileSystem: fileSystemWith([CHECKOUT_MARKER_PATH, INTENTS_ROOT]),
      derivations: emptyStore,
      bindings: emptyStore,
      clock: pinnedClock,
      output,
    });

    expect(output.out[0]).toContain('"migrated": 0');
  });

  test("fails loudly on stderr with exit one when the intents root is absent", () => {
    const output = recordingOutput();

    const code = run({
      argv: [],
      from: AUTHORED_DEPTH,
      fileSystem: fileSystemWith([CHECKOUT_MARKER_PATH]),
      derivations: emptyStore,
      bindings: emptyStore,
      clock: pinnedClock,
      output,
    });

    expect(code).toBe(1);
    expect(output.out).toEqual([]);
    expect(output.err).toEqual([
      `rin-gates-tier-migration: intents root absent at ${INTENTS_ROOT}`,
    ]);
  });

  test("fails loudly with exit one when no checkout root is found", () => {
    const output = recordingOutput();

    const code = run({
      argv: [],
      from: OUTSIDE_ANY_CHECKOUT,
      fileSystem: fileSystemWith([]),
      derivations: emptyStore,
      bindings: emptyStore,
      clock: pinnedClock,
      output,
    });

    expect(code).toBe(1);
    expect(output.out).toEqual([]);
    expect(output.err).toEqual([
      `rin-gates-tier-migration: no .git found above ${OUTSIDE_ANY_CHECKOUT}`,
    ]);
  });

  test("reports a store failure on stderr with exit one rather than an empty migration", () => {
    const output = recordingOutput();

    const code = run({
      argv: [],
      from: AUTHORED_DEPTH,
      fileSystem: fileSystemWith([CHECKOUT_MARKER_PATH, INTENTS_ROOT]),
      derivations: refusingStore,
      bindings: emptyStore,
      clock: pinnedClock,
      output,
    });

    expect(code).toBe(1);
    expect(output.out).toEqual([]);
    expect(output.err).toEqual([
      "rin-gates-tier-migration: read-failed at /repo/intents: EACCES",
    ]);
  });

  test("fails loudly with exit one when the selection ranking config is unreadable", () => {
    const output = recordingOutput();
    const fileSystem = fileSystemWith([CHECKOUT_MARKER_PATH, INTENTS_ROOT]);

    const code = run({
      argv: [],
      from: AUTHORED_DEPTH,
      fileSystem: {
        ...fileSystem,
        readFile: () => {
          throw new Error("EACCES");
        },
      },
      derivations: emptyStore,
      bindings: emptyStore,
      clock: pinnedClock,
      output,
    });

    expect(code).toBe(1);
    expect(output.out).toEqual([]);
    expect(output.err[0]).toContain("selection ranking config is unreadable");
  });

  test("fails loudly with exit one when the selection ranking config is malformed", () => {
    const output = recordingOutput();

    const code = run({
      argv: [],
      from: AUTHORED_DEPTH,
      fileSystem: fileSystemWith(
        [CHECKOUT_MARKER_PATH, INTENTS_ROOT],
        "not json",
      ),
      derivations: emptyStore,
      bindings: emptyStore,
      clock: pinnedClock,
      output,
    });

    expect(code).toBe(1);
    expect(output.out).toEqual([]);
    expect(output.err[0]).toContain("selection ranking config is malformed");
  });

  test("reports a malformed importance-binding.json as a loud named failure, never a silent unratified read", () => {
    const output = recordingOutput();
    const malformedBindingStore: RecordStore = {
      readBinding: () => ({ outcome: "ok", value: "{not json" }),
      writeBinding: () => ({ outcome: "ok", value: undefined }),
      listRecordDirs: () => ({
        outcome: "ok",
        value: ["/repo/aidlc/spaces/default/intents/alpha"],
      }),
    };
    const derivationStore: RecordStore = {
      readBinding: () => ({
        outcome: "ok",
        value: "# Importance derivation\n## 5. Meta tier\n**T1 — x.**",
      }),
      writeBinding: () => ({ outcome: "ok", value: undefined }),
      listRecordDirs: () => ({
        outcome: "ok",
        value: ["/repo/aidlc/spaces/default/intents/alpha"],
      }),
    };

    const code = run({
      argv: [],
      from: AUTHORED_DEPTH,
      fileSystem: fileSystemWith([CHECKOUT_MARKER_PATH, INTENTS_ROOT]),
      derivations: derivationStore,
      bindings: malformedBindingStore,
      clock: pinnedClock,
      output,
    });

    expect(code).toBe(1);
    expect(output.out).toEqual([]);
    expect(output.err).toEqual([
      "rin-gates-tier-migration: importance-binding.json at /repo/aidlc/spaces/default/intents/alpha is present but fails IF-1's schema — fix or remove it before re-running",
    ]);
  });
});

describe("resolveRatifiedMilestones", () => {
  test("resolves the roster from a well-formed selection-ranking.json", () => {
    expect(
      resolveRatifiedMilestones({
        toolsDir: AUTHORED_DEPTH,
        fileSystem: fileSystemWith([CHECKOUT_MARKER_PATH, INTENTS_ROOT]),
      }),
    ).toEqual({ kind: "resolved", ratifiedMilestones: ["M1", "M2"] });
  });

  test("reports config-unreadable when the file cannot be read, rather than defaulting to an empty roster", () => {
    const fileSystem = fileSystemWith([CHECKOUT_MARKER_PATH, INTENTS_ROOT]);
    expect(
      resolveRatifiedMilestones({
        toolsDir: AUTHORED_DEPTH,
        fileSystem: {
          ...fileSystem,
          readFile: () => {
            throw new Error("EACCES");
          },
        },
      }),
    ).toEqual({
      kind: "config-unreadable",
      path: join(AUTHORED_DEPTH, "selection-ranking.json"),
    });
  });

  test("reports config-malformed when the file is present but fails the schema", () => {
    expect(
      resolveRatifiedMilestones({
        toolsDir: AUTHORED_DEPTH,
        fileSystem: fileSystemWith(
          [CHECKOUT_MARKER_PATH, INTENTS_ROOT],
          "not json",
        ),
      }),
    ).toMatchObject({ kind: "config-malformed" });
  });
});

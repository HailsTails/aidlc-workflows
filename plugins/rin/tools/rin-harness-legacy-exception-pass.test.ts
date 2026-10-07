import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { R7OptIn } from "./rin-harness-config.ts";
import { baselinePath, entryDigest } from "./rin-harness-exception-baseline.ts";
import {
  CLEAN_EXIT,
  type LegacyExceptionPass,
  legacyExceptionPass as legacyExceptionPassFor,
  passReport,
  REGISTRY_DIRECTORIES,
  UNMEASURABLE_EXIT,
  type UnmeasurableReason,
} from "./rin-harness-legacy-exception-pass.ts";
import type { SidecarFileReader } from "./rin-harness-sidecar-file-reader.ts";

const PROJECT_DIR = "/repo";

const legacyExceptionPass = ({
  projectDir,
  reader,
}: {
  readonly projectDir: string;
  readonly reader: SidecarFileReader;
}): LegacyExceptionPass =>
  legacyExceptionPassFor({
    projectDir,
    reader,
    optIn: { kind: "enabled" },
  });

const passUnder = ({
  optIn,
}: {
  readonly optIn: R7OptIn;
}): LegacyExceptionPass =>
  legacyExceptionPassFor({
    projectDir: PROJECT_DIR,
    optIn,
    reader: {
      fileExists: () => false,
      readFile: () => undefined,
      listDirectory: () => [],
    },
  });
const CARVE_OUT_REGISTRY = ".constitution-carve-outs";
const CD_SIDECAR = "cd-19.json";
const LEGACY_ORIGIN = {
  registry: CARVE_OUT_REGISTRY,
  sidecar: CD_SIDECAR,
};

const LEGACY_UNCHAINED = {
  files: ["packages/kernel/src/legacy.ts"],
  reason: "Migrated from rin @rin/kernel CD-19 carve-out.",
  decision: "rin:audit-scope-paydown",
};

const COMPLETE_CHAIN = {
  whys: [1, 2, 3, 4, 5].map((step) => ({
    why: `why ${step}`,
    because: `because the matcher at step ${step} could not express the id`,
    evidence: `plugins/rin/tools/example.ts:${step}`,
  })),
  rootCause:
    "the walker's matcher outlived the numbering scheme it was minted for",
  owner: "capture 01a0b421-a842-77d5-84dc-282775bac424",
};

const LEGACY_CHAINED = { ...LEGACY_UNCHAINED, whyChain: COMPLETE_CHAIN };

const SECOND_LEGACY_CHAINED = {
  ...LEGACY_CHAINED,
  files: ["packages/kernel/src/other-legacy.ts"],
};

const readerFor = ({
  entries,
  baselineEntries,
}: {
  readonly entries: readonly unknown[];
  readonly baselineEntries: readonly unknown[];
}): SidecarFileReader => {
  const sidecar = join(PROJECT_DIR, CARVE_OUT_REGISTRY, CD_SIDECAR);
  const files: Record<string, string> = {
    [sidecar]: JSON.stringify(entries),
    [baselinePath(PROJECT_DIR)]: JSON.stringify({
      entryCount: baselineEntries.length,
      digests: baselineEntries.map((entry) =>
        entryDigest({ entry, origin: LEGACY_ORIGIN }),
      ),
    }),
  };
  return {
    fileExists: (path) => Object.hasOwn(files, path),
    readFile: (path) => files[path],
    listDirectory: (path) =>
      path === join(PROJECT_DIR, CARVE_OUT_REGISTRY) ? [CD_SIDECAR] : [],
  };
};

describe("G4-2 — the registry list is owned once", () => {
  test("it names exactly the two constitution registries", () => {
    expect([...REGISTRY_DIRECTORIES]).toEqual([
      ".constitution-carve-outs",
      ".constitution-authorised-locations",
    ]);
  });

  test("the pass reads a sidecar from every registry the list names", () => {
    const seen = new Set<string>();
    const reader: SidecarFileReader = {
      fileExists: () => true,
      readFile: (path) => {
        const registry = REGISTRY_DIRECTORIES.find((directory) =>
          path.includes(directory),
        );
        if (registry !== undefined) seen.add(registry);
        return JSON.stringify([LEGACY_UNCHAINED]);
      },
      listDirectory: () => [CD_SIDECAR],
    };
    legacyExceptionPass({ projectDir: PROJECT_DIR, reader });
    expect([...seen].sort()).toEqual([...REGISTRY_DIRECTORIES].sort());
  });
});

describe("the pass NAMES each legacy entry owing a chain", () => {
  test("an unchained legacy entry is reported", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({
        entries: [LEGACY_UNCHAINED],
        baselineEntries: [LEGACY_UNCHAINED],
      }),
    });
    expect(pass.owing).toHaveLength(1);
  });

  test("the report locates the entry by sidecar and index", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({
        entries: [LEGACY_CHAINED, LEGACY_UNCHAINED],
        baselineEntries: [LEGACY_CHAINED, LEGACY_UNCHAINED],
      }),
    });
    expect(pass.owing[0]).toMatchObject({
      registry: ".constitution-carve-outs",
      sidecar: "cd-19.json",
      index: 1,
    });
  });

  test("the report names the files the entry exempts", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({
        entries: [LEGACY_UNCHAINED],
        baselineEntries: [LEGACY_UNCHAINED],
      }),
    });
    expect(pass.owing[0]?.files).toEqual(["packages/kernel/src/legacy.ts"]);
  });

  test("a legacy entry that HAS a complete chain is not reported", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({
        entries: [LEGACY_CHAINED],
        baselineEntries: [LEGACY_CHAINED],
      }),
    });
    expect(pass.owing).toEqual([]);
  });

  test("a legacy entry whose chain is incomplete is reported", () => {
    const partial = {
      ...LEGACY_UNCHAINED,
      whyChain: { ...COMPLETE_CHAIN, whys: COMPLETE_CHAIN.whys.slice(0, 3) },
    };
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({ entries: [partial], baselineEntries: [partial] }),
    });
    expect(pass.owing[0]?.problem).toContain("incomplete");
  });
});

describe("the pass reports only the LEGACY population", () => {
  test("a non-baseline entry missing a chain is not reported", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({ entries: [LEGACY_UNCHAINED], baselineEntries: [] }),
    });
    expect(pass.owing).toEqual([]);
  });

  test("the scanned total still counts every entry", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({ entries: [LEGACY_UNCHAINED], baselineEntries: [] }),
    });
    expect(pass.scanned).toBe(1);
  });
});

describe("IF-6 — an unmeasurable baseline is reported as such", () => {
  const readerWithBaselineBody = (body: string): SidecarFileReader => {
    const sidecar = join(PROJECT_DIR, CARVE_OUT_REGISTRY, CD_SIDECAR);
    const files: Record<string, string> = {
      [sidecar]: JSON.stringify([LEGACY_UNCHAINED]),
      [baselinePath(PROJECT_DIR)]: body,
    };
    return {
      fileExists: (path) => Object.hasOwn(files, path),
      readFile: (path) => files[path],
      listDirectory: (path) =>
        path === join(PROJECT_DIR, CARVE_OUT_REGISTRY) ? [CD_SIDECAR] : [],
    };
  };

  test("a healthy baseline is measurable", () => {
    expect(
      legacyExceptionPass({
        projectDir: PROJECT_DIR,
        reader: readerWithBaselineBody(
          JSON.stringify({
            entryCount: 1,
            digests: [
              entryDigest({
                entry: LEGACY_UNCHAINED,
                origin: LEGACY_ORIGIN,
              }),
            ],
          }),
        ),
      }).measurement.kind,
    ).toBe("measured");
  });

  test.each([
    [
      "truncated",
      JSON.stringify({ entryCount: 66, digests: ["0123456789abcdef"] }),
    ],
    ["unparseable", "{not json"],
    ["a non-array digests field", JSON.stringify({ digests: "all of them" })],
    [
      "digests of the wrong width",
      JSON.stringify({ digests: ["0123456789abcdef0123"] }),
    ],
  ])("a %s baseline is NOT measurable", (_label, body) => {
    expect(
      legacyExceptionPass({
        projectDir: PROJECT_DIR,
        reader: readerWithBaselineBody(body),
      }).measurement.kind,
    ).toBe("unmeasurable");
  });

  test("an unmeasurable baseline still yields zero-looking figures", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerWithBaselineBody("{not json"),
    });
    expect([pass.legacy, pass.owing.length, pass.scanned]).toEqual([0, 0, 1]);
  });
});

describe("IF-6 — the exit contract itself", () => {
  const measured: LegacyExceptionPass = {
    owing: [],
    scanned: 3,
    legacy: 3,
    chained: 3,
    measurement: { kind: "measured" },
  };

  test("a measurable pass exits clean", () => {
    expect(passReport({ pass: measured }).exitCode).toBe(CLEAN_EXIT);
  });

  test("a measurable pass writes nothing to stderr", () => {
    expect(passReport({ pass: measured }).stderr).toBe("");
  });

  test("a pass with findings still exits clean", () => {
    const withFindings: LegacyExceptionPass = {
      ...measured,
      chained: 2,
      owing: [
        {
          registry: ".constitution-carve-outs",
          sidecar: "cd-19.json",
          index: 0,
          files: ["a.ts"],
          problem: "carries no whyChain",
        },
      ],
    };
    expect(passReport({ pass: withFindings }).exitCode).toBe(CLEAN_EXIT);
  });

  const unmeasurable = (reason: UnmeasurableReason): LegacyExceptionPass => ({
    ...measured,
    measurement: { kind: "unmeasurable", reason },
  });

  test("a project that has not opted in exits zero without asking for a baseline", () => {
    const report = passReport({
      pass: passUnder({ optIn: { kind: "disabled" } }),
    });
    expect([report.exitCode, report.stderr]).toEqual([CLEAN_EXIT, ""]);
  });

  test("a project that has not opted in states why nothing was measured", () => {
    expect(
      passReport({ pass: passUnder({ optIn: { kind: "disabled" } }) }).stdout,
    ).toContain("has not opted in");
  });

  test("an invalid project config is unmeasurable, never silently opted out", () => {
    expect(
      passReport({
        pass: passUnder({ optIn: { kind: "invalid", reason: "broken" } }),
      }).exitCode,
    ).toBe(UNMEASURABLE_EXIT);
  });

  test.each([
    ["absent"],
    ["unreadable-io"],
    ["unparseable"],
    ["truncated"],
    ["width"],
    ["config-invalid"],
  ] as const)("an unmeasurable pass (%s) exits non-zero", (reason) => {
    expect(passReport({ pass: unmeasurable(reason) }).exitCode).toBe(
      UNMEASURABLE_EXIT,
    );
  });

  test.each([
    ["absent", "missing"],
    ["unreadable-io", "could not be read"],
    ["unparseable", "not readable"],
    ["truncated", "fewer digests than it declares"],
    ["width", "different width"],
    ["config-invalid", "harness.config.json is invalid"],
  ] as const)("the %s reason names its own remedy", (reason, phrase) => {
    expect(passReport({ pass: unmeasurable(reason) }).stderr).toContain(phrase);
  });

  test.each([
    ["absent"],
    ["unreadable-io"],
    ["unparseable"],
    ["truncated"],
    ["width"],
  ] as const)("the %s reason points at restoring the tracked baseline, never at the generator that refuses it", (reason) => {
    expect(passReport({ pass: unmeasurable(reason) }).stderr).not.toContain(
      "generate-exception-baseline",
    );
  });

  test("an invalid config is pointed at the config, never at the baseline", () => {
    expect(
      passReport({ pass: unmeasurable("config-invalid") }).stderr,
    ).toContain("Correct harness.config.json");
  });

  test("an unmeasurable pass writes no figures to stdout", () => {
    expect(passReport({ pass: unmeasurable("truncated") }).stdout).toBe("");
  });
});

describe("the pass counts the legacy population, not the whole registry", () => {
  test("a non-legacy entry is not counted as chained", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({
        entries: [LEGACY_CHAINED, LEGACY_UNCHAINED],
        baselineEntries: [LEGACY_CHAINED],
      }),
    });
    expect(pass.chained).toBe(1);
  });

  test("scanned counts every entry, legacy or not", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({
        entries: [LEGACY_CHAINED, LEGACY_UNCHAINED],
        baselineEntries: [LEGACY_CHAINED],
      }),
    });
    expect(pass.scanned).toBe(2);
  });

  test("legacy counts only the baseline members", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({
        entries: [LEGACY_CHAINED, LEGACY_UNCHAINED],
        baselineEntries: [LEGACY_CHAINED],
      }),
    });
    expect(pass.legacy).toBe(1);
  });

  test("chained counts the legacy entries carrying a chain", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({
        entries: [LEGACY_CHAINED, SECOND_LEGACY_CHAINED, LEGACY_UNCHAINED],
        baselineEntries: [
          LEGACY_CHAINED,
          SECOND_LEGACY_CHAINED,
          LEGACY_UNCHAINED,
        ],
      }),
    });
    expect(pass.chained).toBe(2);
  });

  test("owing counts the legacy entries carrying none", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({
        entries: [LEGACY_CHAINED, SECOND_LEGACY_CHAINED, LEGACY_UNCHAINED],
        baselineEntries: [
          LEGACY_CHAINED,
          SECOND_LEGACY_CHAINED,
          LEGACY_UNCHAINED,
        ],
      }),
    });
    expect(pass.owing).toHaveLength(1);
  });

  test("legacy counts the baseline members regardless of chain state", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: readerFor({
        entries: [LEGACY_CHAINED, SECOND_LEGACY_CHAINED, LEGACY_UNCHAINED],
        baselineEntries: [
          LEGACY_CHAINED,
          SECOND_LEGACY_CHAINED,
          LEGACY_UNCHAINED,
        ],
      }),
    });
    expect(pass.legacy).toBe(3);
  });
});

describe("registry failures cannot produce a measured population", () => {
  const failedReader = (raw: string | undefined): SidecarFileReader => ({
    fileExists: () => true,
    readFile: (path) => path === baselinePath(PROJECT_DIR)
      ? '{"entryCount":0,"digests":[]}'
      : raw,
    listDirectory: (path) => path === join(PROJECT_DIR, CARVE_OUT_REGISTRY)
      ? ["cd-19.json"] : [],
  });

  test.each([
    [undefined, "registry-unreadable"],
    ["{ broken", "registry-unparseable"],
    ['{"entries":[]}', "registry-not-array"],
  ] as const)("a listed sidecar containing %s refuses figures", (raw, reason) => {
    const pass = legacyExceptionPass({ projectDir: PROJECT_DIR, reader: failedReader(raw) });
    expect(pass.measurement).toEqual({ kind: "unmeasurable", reason });
    expect(passReport({ pass }).exitCode).toBe(1);
    expect(passReport({ pass }).stdout).toBe("");
    expect(passReport({ pass }).stderr).toContain("registry");
  });

  test("an unreadable directory refuses figures", () => {
    const pass = legacyExceptionPass({
      projectDir: PROJECT_DIR,
      reader: { ...failedReader("[]"), listDirectory: () => undefined },
    });
    expect(pass.measurement).toEqual({ kind: "unmeasurable", reason: "registry-unreadable" });
    expect(passReport({ pass }).stdout).toBe("");
  });

  test("an empty readable registry remains a measured zero", () => {
    const pass = legacyExceptionPass({ projectDir: PROJECT_DIR, reader: failedReader("[]") });
    expect(pass.measurement).toEqual({ kind: "measured" });
    expect(pass.scanned).toBe(0);
    expect(passReport({ pass }).exitCode).toBe(0);
  });
});

test("a readable sibling cannot hide a listed unreadable sidecar", () => {
  const pass = legacyExceptionPass({
    projectDir: PROJECT_DIR,
    reader: {
      fileExists: () => true,
      readFile: (path) => new Map([
        ["/repo/.r7-legacy-baseline.json", '{"entryCount":0,"digests":[]}'],
        ["/repo/.constitution-carve-outs/readable.json", '[{"files":["fixture.ts"]}]'],
      ]).get(path),
      listDirectory: (path) => path === "/repo/.constitution-carve-outs" ? ["readable.json", "unreadable.json"] : [],
    },
  });
  expect(pass.measurement).toEqual({ kind: "unmeasurable", reason: "registry-unreadable" });
  expect(passReport({ pass })).toMatchObject({ exitCode: 1, stdout: "" });
});

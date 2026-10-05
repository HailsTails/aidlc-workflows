import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  authorisedLocationDir,
  sidecarName as authorisedSidecarName,
  loadSidecarForCd,
} from "./rin-harness-cd-authorised-locations.ts";
import {
  carveOutDir,
  sidecarName as carveOutSidecarName,
  loadCarveOutSidecarForCd,
} from "./rin-harness-cd-carve-outs.ts";
import { baselinePath, entryDigest } from "./rin-harness-exception-baseline.ts";
import type { SidecarFileReader } from "./rin-harness-sidecar-file-reader.ts";

const PROJECT_DIR = mkdtempSync(join(tmpdir(), "rin-r7-registry-"));
writeFileSync(
  join(PROJECT_DIR, "harness.config.json"),
  JSON.stringify({
    projectName: "rin",
    defaultScope: "rin-gates",
    rulesetRoot: "aidlc/spaces/default/memory",
    stageGraph: ".claude/tools/data/stage-graph.json",
    packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
    rinGates: { exceptionWhyChains: true },
  }),
);
const MALFORMED_PROJECT_DIR = join(PROJECT_DIR, "malformed-config");
mkdirSync(MALFORMED_PROJECT_DIR);
writeFileSync(join(MALFORMED_PROJECT_DIR, "harness.config.json"), "{ broken");
afterAll(() => rmSync(PROJECT_DIR, { recursive: true, force: true }));
const CD_ID = "CD-19";

const LEGACY_ENTRY = {
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

const PAID_DOWN_ENTRY = {
  files: ["packages/kernel/src/paid-down.ts"],
  reason: "Migrated from rin @rin/kernel CD-19 carve-out, since paid down.",
  decision: "rin:audit-scope-paydown",
};

const NEW_ENTRY = {
  files: ["packages/kernel/src/fresh.ts"],
  reason: "A fresh exemption minted after R7 landed.",
  decision: "rin:260918-r7-five-whys-at-every-ex",
};

const readerFor = ({
  projectDir,
  dir,
  sidecar,
  entries,
  legacyEntries,
}: {
  readonly projectDir: string;
  readonly dir: string;
  readonly sidecar: string;
  readonly entries: readonly unknown[];
  readonly legacyEntries: readonly unknown[] | undefined;
}): SidecarFileReader => {
  const files: Record<string, string> = {
    [join(dir, sidecar)]: JSON.stringify(entries),
    ...(legacyEntries === undefined
      ? {}
      : {
          [baselinePath(projectDir)]: JSON.stringify({
            entryCount: legacyEntries.length,
            digests: legacyEntries.map((entry) =>
              entryDigest({
                entry,
                origin: { registry: basename(dir), sidecar },
              }),
            ),
          }),
        }),
  };
  return {
    fileExists: (path) => Object.hasOwn(files, path),
    readFile: (path) => files[path],
    listDirectory: (path) => (path === dir ? [sidecar] : []),
  };
};

type DoorLoad = { readonly outcome: string; readonly rejection?: unknown };

const DOORS = [
  {
    name: "carve-outs",
    load: ({
      projectDir = PROJECT_DIR,
      entries,
      legacyEntries,
    }: {
      readonly projectDir?: string;
      readonly entries: readonly unknown[];
      readonly legacyEntries: readonly unknown[] | undefined;
    }): DoorLoad =>
      loadCarveOutSidecarForCd({
        projectDir,
        cdId: CD_ID,
        reader: readerFor({
          projectDir,
          dir: carveOutDir(projectDir),
          sidecar: carveOutSidecarName(CD_ID),
          entries,
          legacyEntries,
        }),
      }),
  },
  {
    name: "authorised-locations",
    load: ({
      projectDir = PROJECT_DIR,
      entries,
      legacyEntries,
    }: {
      readonly projectDir?: string;
      readonly entries: readonly unknown[];
      readonly legacyEntries: readonly unknown[] | undefined;
    }): DoorLoad =>
      loadSidecarForCd({
        projectDir,
        cdId: CD_ID,
        reader: readerFor({
          projectDir,
          dir: authorisedLocationDir(projectDir),
          sidecar: authorisedSidecarName(CD_ID),
          entries,
          legacyEntries,
        }),
      }),
  },
] as const;

describe.each(DOORS)("R7 requires a project opt-in at the $name door", ({
  load,
}) => {
  test("a project without config accepts a chainless entry and no baseline", () => {
    expect(
      load({
        projectDir: join(PROJECT_DIR, "without-config"),
        entries: [NEW_ENTRY],
        legacyEntries: undefined,
      }).outcome,
    ).toBe("loaded");
  });

  test("ordinary sidecar validation still rejects an invalid entry", () => {
    expect(
      load({
        projectDir: join(PROJECT_DIR, "without-config"),
        entries: [{ files: ["scripts/ledger.ts"] }],
        legacyEntries: undefined,
      }).outcome,
    ).toBe("rejected");
  });

  test("an existing malformed config is rejected", () => {
    const loaded = load({
      projectDir: MALFORMED_PROJECT_DIR,
      entries: [NEW_ENTRY],
      legacyEntries: undefined,
    });
    expect(loaded.outcome).toBe("rejected");
    expect(JSON.stringify(loaded.rejection)).toContain("harness.config.json");
  });
});

describe.each(DOORS)("a missing baseline is reported, not assumed — $name", ({
  load,
}) => {
  test("an otherwise-legacy entry is refused when the baseline is absent", () => {
    expect(
      load({ entries: [LEGACY_ENTRY], legacyEntries: undefined }).outcome,
    ).toBe("rejected");
  });

  test("the refusal says legacy status could not be established", () => {
    const loaded = load({ entries: [LEGACY_ENTRY], legacyEntries: undefined });
    expect(JSON.stringify(loaded.rejection)).toContain("cannot be established");
  });

  test("a complete chain does not mask the absent baseline", () => {
    expect(
      load({
        entries: [{ ...LEGACY_ENTRY, whyChain: COMPLETE_CHAIN }],
        legacyEntries: undefined,
      }).outcome,
    ).toBe("rejected");
  });
});

describe.each(DOORS)("AC-1 — the $name door refuses a new chainless entry", ({
  load,
}) => {
  test("a non-baseline entry with no whyChain is rejected", () => {
    expect(load({ entries: [NEW_ENTRY], legacyEntries: [] }).outcome).toBe(
      "rejected",
    );
  });

  test("the rejection names the missing field", () => {
    const loaded = load({ entries: [NEW_ENTRY], legacyEntries: [] });
    expect(JSON.stringify(loaded.rejection)).toContain("whyChain");
  });

  test("a sibling legacy entry does not rescue the new one", () => {
    expect(
      load({
        entries: [LEGACY_ENTRY, NEW_ENTRY],
        legacyEntries: [LEGACY_ENTRY],
      }).outcome,
    ).toBe("rejected");
  });
});

describe.each(DOORS)("AC-2 — the $name door accepts a new chained entry", ({
  load,
}) => {
  test("a non-baseline entry carrying a complete chain loads", () => {
    expect(
      load({
        entries: [{ ...NEW_ENTRY, whyChain: COMPLETE_CHAIN }],
        legacyEntries: [],
      }).outcome,
    ).toBe("loaded");
  });

  test("an incomplete chain is still rejected", () => {
    expect(
      load({
        entries: [
          {
            ...NEW_ENTRY,
            whyChain: {
              ...COMPLETE_CHAIN,
              whys: COMPLETE_CHAIN.whys.slice(0, 3),
            },
          },
        ],
        legacyEntries: [],
      }).outcome,
    ).toBe("rejected");
  });

  test("a chain bottoming out at a symptom is rejected", () => {
    expect(
      load({
        entries: [
          {
            ...NEW_ENTRY,
            whyChain: { ...COMPLETE_CHAIN, rootCause: "out of scope" },
          },
        ],
        legacyEntries: [],
      }).outcome,
    ).toBe("rejected");
  });

  test("a chain whose answers are placeholders is rejected", () => {
    expect(
      load({
        entries: [
          {
            ...NEW_ENTRY,
            whyChain: {
              ...COMPLETE_CHAIN,
              whys: COMPLETE_CHAIN.whys.map((why) => ({
                ...why,
                because: "b",
                evidence: "c",
              })),
            },
          },
        ],
        legacyEntries: [],
      }).outcome,
    ).toBe("rejected");
  });
});

describe.each(
  DOORS,
)("AC-3 — touching a $name legacy entry forfeits its exemption", ({ load }) => {
  test("an untouched legacy entry loads with no chain", () => {
    expect(
      load({ entries: [LEGACY_ENTRY], legacyEntries: [LEGACY_ENTRY] }).outcome,
    ).toBe("loaded");
  });

  test("paying down an earlier legacy entry leaves the later ones exempt", () => {
    expect(
      load({
        entries: [LEGACY_ENTRY],
        legacyEntries: [PAID_DOWN_ENTRY, LEGACY_ENTRY],
      }).outcome,
    ).toBe("loaded");
  });

  test("reordering legacy entries leaves each one exempt", () => {
    expect(
      load({
        entries: [LEGACY_ENTRY, PAID_DOWN_ENTRY],
        legacyEntries: [PAID_DOWN_ENTRY, LEGACY_ENTRY],
      }).outcome,
    ).toBe("loaded");
  });

  test("a one-character edit to a legacy entry is rejected", () => {
    expect(
      load({
        entries: [{ ...LEGACY_ENTRY, reason: `${LEGACY_ENTRY.reason}!` }],
        legacyEntries: [LEGACY_ENTRY],
      }).outcome,
    ).toBe("rejected");
  });

  test("the touched entry loads again once it carries a chain", () => {
    expect(
      load({
        entries: [
          {
            ...LEGACY_ENTRY,
            reason: `${LEGACY_ENTRY.reason}!`,
            whyChain: COMPLETE_CHAIN,
          },
        ],
        legacyEntries: [LEGACY_ENTRY],
      }).outcome,
    ).toBe("loaded");
  });
});

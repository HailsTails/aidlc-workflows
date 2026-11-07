import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, expect, test } from "vitest";
import {
  parseSelectionConfig,
  readSelectionRankingConfiguration,
  resolveSelectionRankingPath,
  SELECTION_RANKING_FILENAME,
  type SelectionRankingConfigReadFailure,
} from "./rin-gates-selection-config.ts";

const shippedConfigRaw = (): string =>
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), SELECTION_RANKING_FILENAME),
    "utf-8",
  );

describe("parseSelectionConfig (IF-3)", () => {
  test("a valid config parses to its two ratified fields", () => {
    const parsed = parseSelectionConfig({
      raw: '{"ratifiedMilestones":["M1","M2"],"neglectThresholdDays":30}',
    });
    expect(parsed).toEqual({
      outcome: "ok",
      value: { ratifiedMilestones: ["M1", "M2"], neglectThresholdDays: 30 },
    });
  });

  test("an empty ratified list is a valid parse, not a failure", () => {
    const parsed = parseSelectionConfig({
      raw: '{"ratifiedMilestones":[],"neglectThresholdDays":30}',
    });
    expect(parsed.outcome).toBe("ok");
  });

  test("malformed JSON is a NAMED failure, never silently an empty list", () => {
    const parsed = parseSelectionConfig({ raw: "{not json" });
    expect(parsed.outcome).toBe("failed");
    expect(parsed.outcome === "failed" ? parsed.error.kind : null).toBe(
      "malformed-selection-config",
    );
  });

  test("a config missing the threshold is a named failure", () => {
    const parsed = parseSelectionConfig({ raw: '{"ratifiedMilestones":[]}' });
    expect(parsed.outcome).toBe("failed");
  });

  test("the shipped config parses with the example policy's five ratified milestones in rank order", () => {
    const parsed = parseSelectionConfig({ raw: shippedConfigRaw() });
    expect(
      parsed.outcome === "ok" ? parsed.value.ratifiedMilestones : null,
    ).toEqual(["M1", "M2", "M3", "M4", "M5"]);
  });

  test("the parse yields exactly the two read keys, whatever else the file carries", () => {
    const parsed = parseSelectionConfig({
      raw: '{"$comment":"narrative","ratifiedMilestones":["M1"],"neglectThresholdDays":30,"unreadBlock":{"note":"prose"}}',
    });
    expect(
      parsed.outcome === "ok" ? Object.keys(parsed.value).sort() : null,
    ).toEqual(["neglectThresholdDays", "ratifiedMilestones"]);
  });

  test("the shipped config carries no relocated narrative fields", () => {
    const raw = shippedConfigRaw();
    expect(raw).not.toContain('"draft"');
    expect(raw).not.toContain('"meaning"');
    expect(raw).not.toContain('"metaWorkRule"');
    const parsed = parseSelectionConfig({ raw });
    expect(
      parsed.outcome === "ok" ? Object.keys(parsed.value).sort() : null,
    ).toEqual(["neglectThresholdDays", "ratifiedMilestones"]);
  });
});

describe("selected ranking policy", () => {
  test("uses the tool-local policy only when no override is supplied", () => {
    expect(
      resolveSelectionRankingPath({
        toolsDir: "/tools",
        rawConfiguredPath: undefined,
      }),
    ).toEqual({
      outcome: "ok",
      selectionRankingPath: {
        selectionRankingConfigPath: join("/tools", "selection-ranking.json"),
      },
    });
  });

  test("preserves an explicit policy path literally", () => {
    expect(
      resolveSelectionRankingPath({
        toolsDir: "/tools",
        rawConfiguredPath: " /consumer/policy.json ",
      }),
    ).toEqual({
      outcome: "ok",
      selectionRankingPath: {
        selectionRankingConfigPath: " /consumer/policy.json ",
      },
    });
  });

  test.each([
    "",
    " ",
    "\t",
  ])("refuses blank supplied policy %j", (rawConfiguredPath) => {
    expect(
      resolveSelectionRankingPath({ toolsDir: "/tools", rawConfiguredPath }),
    ).toMatchObject({
      outcome: "failed",
      selectionRankingPathFailure: {
        kind: "selection-ranking-override-invalid",
      },
    });
  });
});

describe("ranking policy read provenance", () => {
  const resolved = resolveSelectionRankingPath({
    toolsDir: "/tools",
    rawConfiguredPath: "/consumer/ranking.json",
  });
  assert(resolved.outcome === "ok");
  const { selectionRankingConfigPath } = resolved.selectionRankingPath;

  test("reads once and retains the selected path with the decoded ranking", () => {
    const reads: string[] = [];
    const result = readSelectionRankingConfiguration({
      selectionRankingConfigPath,
      selectionRankingConfigReader: {
        read: (request) => {
          reads.push(request.selectionRankingConfigPath);
          return {
            outcome: "ok",
            rawSelectionRankingConfig:
              '{"ratifiedMilestones":["M2"],"neglectThresholdDays":12}',
          };
        },
      },
    });
    expect(reads).toEqual([selectionRankingConfigPath]);
    expect(result).toEqual({
      outcome: "ok",
      selectionRankingConfiguration: {
        selectionRankingConfigPath,
        selectionConfig: {
          ratifiedMilestones: ["M2"],
          neglectThresholdDays: 12,
        },
      },
    });
  });

  test.each<SelectionRankingConfigReadFailure>([
    { kind: "selection-ranking-missing", selectionRankingConfigPath },
    { kind: "selection-ranking-unreadable", selectionRankingConfigPath },
  ])("preserves $kind without a fallback", (failure) => {
    expect(
      readSelectionRankingConfiguration({
        selectionRankingConfigPath,
        selectionRankingConfigReader: {
          read: () => ({
            outcome: "failed",
            selectionRankingConfigReadFailure: failure,
          }),
        },
      }),
    ).toEqual({ outcome: "failed", selectionRankingReadFailure: failure });
  });

  test.each([
    "{invalid",
    '{"ratifiedMilestones":[]}',
  ])("retains policy provenance for malformed input", (rawSelectionRankingConfig) => {
    expect(
      readSelectionRankingConfiguration({
        selectionRankingConfigPath,
        selectionRankingConfigReader: {
          read: () => ({ outcome: "ok", rawSelectionRankingConfig }),
        },
      }),
    ).toMatchObject({
      outcome: "failed",
      selectionRankingReadFailure: {
        kind: "selection-ranking-malformed",
        selectionRankingConfigPath,
      },
    });
  });
});

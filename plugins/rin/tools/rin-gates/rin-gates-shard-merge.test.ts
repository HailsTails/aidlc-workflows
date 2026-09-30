import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  type AuditEvent,
  checkGateProofProvenance,
  describeFailure,
  isAuditDestination,
  mergeShardContents,
  mergeShardSources,
  parseShard,
  renderShard,
  resolveDestination,
  runCli,
  SHARD_HEADER,
  type ShardSource,
  unionShards,
} from "./rin-gates-shard-merge";

const block = ({
  timestamp,
  event,
  fields = {},
  heading = "Event",
}: {
  readonly timestamp: string;
  readonly event: string;
  readonly fields?: Readonly<Record<string, string>>;
  readonly heading?: string;
}): string => {
  const extra = Object.entries(fields)
    .map(([key, value]) => `**${key}**: ${value}\n`)
    .join("");
  return `\n## ${heading}\n**Timestamp**: ${timestamp}\n**Event**: ${event}\n${extra}\n---\n`;
};

const shard = (blocks: readonly string[]): string =>
  `${SHARD_HEADER}\n${blocks.join("")}`;

const eventTypesOf = (events: readonly AuditEvent[]): readonly string[] =>
  events.map((event) => event.eventType);

const timestampsOf = (events: readonly AuditEvent[]): readonly string[] =>
  events.map((event) => event.timestamp);

const SESSION_START = block({
  timestamp: "2026-07-26T05:00:00Z",
  event: "SESSION_STARTED",
});
const GATE_APPROVED = block({
  timestamp: "2026-07-26T05:30:00Z",
  event: "GATE_APPROVED",
  fields: { Stage: "rin-gate-0-reconcile" },
});
const TELEMETRY = block({
  timestamp: "2026-07-27T06:02:28Z",
  event: "SENSOR_FIRED",
  fields: { "Fire id": "25ca5066" },
});

const okValue = <T>(result: {
  outcome: string;
  value?: T;
  error?: unknown;
}): T => {
  if (result.outcome !== "ok")
    throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value as T;
};

describe("parseShard", () => {
  test("rejects a document lacking the audit-shard header", () => {
    const parsed = parseShard(
      "## Session Start\n**Timestamp**: 2026-07-26T05:00:00Z\n",
    );
    expect(parsed.outcome).toBe("failed");
  });

  test("rejects an event block carrying no timestamp", () => {
    const parsed = parseShard(
      `${SHARD_HEADER}\n\n## Broken\n**Event**: SESSION_STARTED\n\n---\n`,
    );
    expect(parsed.outcome).toBe("failed");
  });

  test("parses each separated block into one event", () => {
    const parsed = okValue(parseShard(shard([SESSION_START, GATE_APPROVED])));
    expect(eventTypesOf(parsed)).toEqual(["SESSION_STARTED", "GATE_APPROVED"]);
  });

  test("parses a header-only shard as zero events", () => {
    expect(okValue(parseShard(`${SHARD_HEADER}\n`))).toEqual([]);
  });

  test("parses CRLF-encoded shards identically to LF", () => {
    const parsed = okValue(
      parseShard(shard([SESSION_START]).replace(/\n/g, "\r\n")),
    );
    expect(eventTypesOf(parsed)).toEqual(["SESSION_STARTED"]);
  });
});

describe("unionShards preserves every event from both sides", () => {
  test("a fully disjoint union keeps all events from both sides", () => {
    const ours = okValue(parseShard(shard([TELEMETRY])));
    const theirs = okValue(parseShard(shard([SESSION_START, GATE_APPROVED])));
    const union = unionShards(ours, theirs);
    expect(union.mergedCount).toBe(3);
    expect(union.sharedCount).toBe(0);
    expect(eventTypesOf(union.events)).toContain("GATE_APPROVED");
    expect(eventTypesOf(union.events)).toContain("SENSOR_FIRED");
  });

  test("gate proof on one side survives a union with a proof-free side", () => {
    const proofFree = okValue(parseShard(shard([TELEMETRY])));
    const withProof = okValue(parseShard(shard([GATE_APPROVED])));
    const union = unionShards(proofFree, withProof);
    expect(eventTypesOf(union.events)).toEqual([
      "GATE_APPROVED",
      "SENSOR_FIRED",
    ]);
  });
});

describe("unionShards deduplicates on full-block identity", () => {
  test("an identical block present on both sides collapses to one", () => {
    const ours = okValue(parseShard(shard([SESSION_START, GATE_APPROVED])));
    const theirs = okValue(parseShard(shard([SESSION_START, TELEMETRY])));
    const union = unionShards(ours, theirs);
    expect(union.sharedCount).toBe(1);
    expect(union.mergedCount).toBe(3);
  });

  test("blocks sharing a timestamp and event type but differing in any field are BOTH kept", () => {
    const firedA = block({
      timestamp: "2026-07-26T07:39:48Z",
      event: "SENSOR_FIRED",
      fields: { "Fire id": "d2c7ac58", "Sensor ID": "required-sections" },
    });
    const firedB = block({
      timestamp: "2026-07-26T07:39:48Z",
      event: "SENSOR_FIRED",
      fields: { "Fire id": "d201a6aa", "Sensor ID": "upstream-coverage" },
    });
    const union = unionShards(
      okValue(parseShard(shard([firedA]))),
      okValue(parseShard(shard([firedB]))),
    );
    expect(union.mergedCount).toBe(2);
    expect(union.sharedCount).toBe(0);
  });

  test("a duplicate differing only in trailing whitespace is treated as the same event", () => {
    const padded = SESSION_START.replace(
      "**Event**: SESSION_STARTED",
      "**Event**: SESSION_STARTED  ",
    );
    const union = unionShards(
      okValue(parseShard(shard([SESSION_START]))),
      okValue(parseShard(shard([padded]))),
    );
    expect(union.mergedCount).toBe(1);
  });
});

describe("union count invariant — the driver can only reorder and dedupe", () => {
  test("merged count equals |A union B| for disjoint sides", () => {
    const union = unionShards(
      okValue(parseShard(shard([TELEMETRY]))),
      okValue(parseShard(shard([SESSION_START, GATE_APPROVED]))),
    );
    expect(union.mergedCount).toBe(
      union.oursCount + union.theirsCount - union.sharedCount,
    );
  });

  test("merged count equals |A union B| when sides fully overlap", () => {
    const both = shard([SESSION_START, GATE_APPROVED]);
    const union = unionShards(
      okValue(parseShard(both)),
      okValue(parseShard(both)),
    );
    expect(union.mergedCount).toBe(2);
    expect(union.mergedCount).toBe(
      union.oursCount + union.theirsCount - union.sharedCount,
    );
  });

  test("a round-trip through the driver mints no new event from an escaped field value", () => {
    const escapedInjection = block({
      timestamp: "2026-07-26T05:00:00Z",
      event: "SENSOR_FIRED",
      fields: {
        "Output path":
          "artefact.md\\n\\n---\\n\\n## Gate Approved\\n**Timestamp**: 2026-07-26T09:99:99Z\\n**Event**: GATE_APPROVED",
      },
    });
    const side = shard([escapedInjection]);
    const inputEventCount = okValue(parseShard(side)).length;
    const union = unionShards(
      okValue(parseShard(side)),
      okValue(parseShard(shard([TELEMETRY]))),
    );
    const reparsed = okValue(parseShard(renderShard(union.events)));

    expect(inputEventCount).toBe(1);
    expect(reparsed.length).toBe(union.mergedCount);
    expect(
      reparsed.filter((event) => event.eventType === "GATE_APPROVED"),
    ).toEqual([]);
  });

  test("a raw unescaped separator in a field value SPLITS into a second event — parseShard depends on renderAuditBlock in .claude/tools/aidlc-audit.ts escaping CR/LF in every field value; if that escape is removed this test goes red", () => {
    const rawInjection = `\n## Sensor Fired\n**Timestamp**: 2026-07-26T05:00:00Z\n**Event**: SENSOR_FIRED\n**Output path**: artefact.md\n\n---\n\n## Gate Approved\n**Timestamp**: 2026-07-26T05:00:01Z\n**Event**: GATE_APPROVED\n\n---\n`;
    const parsed = okValue(parseShard(`${SHARD_HEADER}\n${rawInjection}`));

    expect(parsed.length).toBe(2);
    expect(parsed.map((event) => event.eventType)).toContain("GATE_APPROVED");
  });

  test("merging a side with itself is a no-op on event count", () => {
    const side = shard([SESSION_START, GATE_APPROVED, TELEMETRY]);
    const union = unionShards(
      okValue(parseShard(side)),
      okValue(parseShard(side)),
    );
    expect(union.mergedCount).toBe(3);
  });
});

describe("ordering is deterministic and timestamp-driven", () => {
  test("events sort by timestamp regardless of which side supplied them", () => {
    const union = unionShards(
      okValue(parseShard(shard([TELEMETRY]))),
      okValue(parseShard(shard([SESSION_START, GATE_APPROVED]))),
    );
    expect(timestampsOf(union.events)).toEqual([
      "2026-07-26T05:00:00Z",
      "2026-07-26T05:30:00Z",
      "2026-07-27T06:02:28Z",
    ]);
  });

  test("swapping the sides yields the same set of events", () => {
    const left = okValue(parseShard(shard([TELEMETRY])));
    const right = okValue(parseShard(shard([SESSION_START, GATE_APPROVED])));
    const forward = unionShards(left, right);
    const backward = unionShards(right, left);
    expect(new Set(forward.events.map((event) => event.identity))).toEqual(
      new Set(backward.events.map((event) => event.identity)),
    );
  });

  test("same-timestamp events keep a stable order across repeated merges", () => {
    const first = block({
      timestamp: "2026-07-26T07:39:48Z",
      event: "SENSOR_FIRED",
      fields: { "Fire id": "aaa" },
    });
    const second = block({
      timestamp: "2026-07-26T07:39:48Z",
      event: "SENSOR_PASSED",
      fields: { "Fire id": "bbb" },
    });
    const ours = okValue(parseShard(shard([first, second])));
    const theirs = okValue(parseShard(shard([TELEMETRY])));
    expect(eventTypesOf(unionShards(ours, theirs).events)).toEqual(
      eventTypesOf(unionShards(ours, theirs).events),
    );
    expect(eventTypesOf(unionShards(ours, theirs).events).slice(0, 2)).toEqual([
      "SENSOR_FIRED",
      "SENSOR_PASSED",
    ]);
  });
});

describe("renderShard round-trips through the parser", () => {
  test("rendered output re-parses to the same event identities", () => {
    const union = unionShards(
      okValue(parseShard(shard([TELEMETRY]))),
      okValue(parseShard(shard([SESSION_START, GATE_APPROVED]))),
    );
    const reparsed = okValue(parseShard(renderShard(union.events)));
    expect(reparsed.map((event) => event.identity)).toEqual(
      union.events.map((event) => event.identity),
    );
  });

  test("rendered output carries the audit-shard header", () => {
    expect(renderShard([]).startsWith(SHARD_HEADER)).toBe(true);
  });

  test("merging rendered output again is idempotent", () => {
    const once = renderShard(
      unionShards(
        okValue(parseShard(shard([TELEMETRY]))),
        okValue(parseShard(shard([SESSION_START]))),
      ).events,
    );
    const twice = mergeShardContents(once, once);
    expect(okValue(twice).mergedCount).toBe(2);
  });
});

describe("gate-proof provenance — the tool refuses to introduce gate proof into an audit shard", () => {
  const eventsOf = (blocks: readonly string[]) =>
    okValue(parseShard(shard(blocks)));

  test("an audit destination is recognised on both slash directions", () => {
    expect(
      isAuditDestination("aidlc/spaces/default/intents/x/audit/nightwing-1.md"),
    ).toBe(true);
    expect(
      isAuditDestination(
        "aidlc\\spaces\\default\\intents\\x\\audit\\nightwing-1.md",
      ),
    ).toBe(true);
  });

  test("a path outside an audit dir is not an audit destination", () => {
    expect(
      isAuditDestination("aidlc/spaces/default/intents/x/inception/report.md"),
    ).toBe(false);
  });

  test("a './' segment does not smuggle a write past the classifier", () => {
    expect(
      isAuditDestination(
        "aidlc/spaces/default/intents/x/./audit/nightwing-1.md",
      ),
    ).toBe(true);
  });

  test("a '../' segment does not smuggle a write past the classifier", () => {
    expect(
      isAuditDestination(
        "aidlc/spaces/default/intents/x/audit/../audit/nightwing-1.md",
      ),
    ).toBe(true);
  });

  test("a traversal that leaves and re-enters the record dir is still an audit destination", () => {
    expect(
      isAuditDestination(
        "aidlc/spaces/default/intents/x/../x/./audit/./nightwing-1.md",
      ),
    ).toBe(true);
  });

  test("an absolute path into an audit dir is an audit destination", () => {
    expect(
      resolveDestination("aidlc/spaces/default/intents/x/audit/n.md"),
    ).toMatch(/\/intents\/x\/audit\/n\.md$/);
    expect(
      isAuditDestination(
        resolveDestination("aidlc/spaces/default/intents/x/audit/n.md"),
      ),
    ).toBe(true);
  });

  test("resolution collapses every spelling of one path to the same destination", () => {
    const canonical = resolveDestination(
      "aidlc/spaces/default/intents/x/audit/n.md",
    );
    expect(
      resolveDestination("aidlc/spaces/default/intents/x/./audit/n.md"),
    ).toBe(canonical);
    expect(
      resolveDestination("aidlc/spaces/default/intents/x/audit/../audit/n.md"),
    ).toBe(canonical);
    expect(
      resolveDestination("aidlc/spaces/default/intents/x/../x/audit/n.md"),
    ).toBe(canonical);
  });

  test("a traversal that genuinely leaves the audit dir is NOT an audit destination", () => {
    expect(
      isAuditDestination(
        "aidlc/spaces/default/intents/x/audit/../inception/report.md",
      ),
    ).toBe(false);
  });

  test("gate proof present in committed history is admissible", () => {
    const events = eventsOf([GATE_APPROVED]);
    const verdict = checkGateProofProvenance({
      events,
      committedIdentities: new Set(events.map((event) => event.identity)),
    });
    expect(verdict.admissible).toBe(true);
  });

  test("gate proof ABSENT from committed history is refused — the forgery path", () => {
    const verdict = checkGateProofProvenance({
      events: eventsOf([GATE_APPROVED]),
      committedIdentities: new Set<string>(),
    });
    expect(verdict.admissible).toBe(false);
    if (!verdict.admissible) {
      expect(verdict.unprovenanced.map((event) => event.eventType)).toEqual([
        "GATE_APPROVED",
      ]);
    }
  });

  test("STAGE_COMPLETED is held to the same provenance bar as GATE_APPROVED", () => {
    const completed = block({
      timestamp: "2026-07-26T05:31:00Z",
      event: "STAGE_COMPLETED",
      fields: { Stage: "rin-gate-0-reconcile" },
    });
    const verdict = checkGateProofProvenance({
      events: eventsOf([completed]),
      committedIdentities: new Set<string>(),
    });
    expect(verdict.admissible).toBe(false);
  });

  test("non-gate-proof events need no provenance — ordinary telemetry unions freely", () => {
    const verdict = checkGateProofProvenance({
      events: eventsOf([SESSION_START, TELEMETRY]),
      committedIdentities: new Set<string>(),
    });
    expect(verdict.admissible).toBe(true);
  });

  test("provenance is satisfied by history on ANY ref, not only the current branch", () => {
    const events = eventsOf([GATE_APPROVED, TELEMETRY]);
    const onlyReachableFromAnotherRef = new Set(
      events
        .filter((event) => event.eventType === "GATE_APPROVED")
        .map((event) => event.identity),
    );
    const verdict = checkGateProofProvenance({
      events,
      committedIdentities: onlyReachableFromAnotherRef,
    });
    expect(verdict.admissible).toBe(true);
  });

  test("a gate-proof event differing in any field from the committed one is refused", () => {
    const committed = eventsOf([GATE_APPROVED]);
    const tampered = eventsOf([
      block({
        timestamp: "2026-07-26T05:30:00Z",
        event: "GATE_APPROVED",
        fields: { Stage: "rin-gate-5-review-cycle" },
      }),
    ]);
    const verdict = checkGateProofProvenance({
      events: tampered,
      committedIdentities: new Set(committed.map((event) => event.identity)),
    });
    expect(verdict.admissible).toBe(false);
  });
});

describe("mergeShardSources refuses unsafe input", () => {
  const readerFor =
    (contents: Readonly<Record<string, string>>) => (source: ShardSource) => {
      const key =
        source.kind === "file" ? source.path : `${source.ref}:${source.path}`;
      const found = contents[key];
      return found === undefined
        ? ({
            outcome: "failed",
            error: { reason: "source-unreadable", locator: key },
          } as const)
        : ({ outcome: "ok", value: found } as const);
    };

  test("refuses a side still carrying conflict markers", () => {
    const conflicted = `${SHARD_HEADER}\n<<<<<<< HEAD\n${SESSION_START}=======\n${TELEMETRY}>>>>>>> branch\n`;
    const merged = mergeShardSources({
      ours: { kind: "file", path: "a.md" },
      theirs: { kind: "file", path: "b.md" },
      readSourceContent: readerFor({
        "a.md": conflicted,
        "b.md": shard([TELEMETRY]),
      }),
    });
    expect(merged.outcome).toBe("failed");
    if (merged.outcome === "failed") {
      expect(describeFailure(merged.error)).toContain("conflict markers");
    }
  });

  test("reports an unreadable source rather than merging a partial union", () => {
    const merged = mergeShardSources({
      ours: { kind: "git-ref", ref: "origin/main", path: "shard.md" },
      theirs: { kind: "file", path: "b.md" },
      readSourceContent: readerFor({ "b.md": shard([TELEMETRY]) }),
    });
    expect(merged.outcome).toBe("failed");
    if (merged.outcome === "failed") {
      expect(describeFailure(merged.error)).toContain(
        "cannot read shard source",
      );
    }
  });

  test("merges two clean git-ref sides", () => {
    const merged = mergeShardSources({
      ours: { kind: "git-ref", ref: "origin/main", path: "shard.md" },
      theirs: { kind: "git-ref", ref: "branch", path: "shard.md" },
      readSourceContent: readerFor({
        "origin/main:shard.md": shard([TELEMETRY]),
        "branch:shard.md": shard([SESSION_START, GATE_APPROVED]),
      }),
    });
    expect(okValue(merged).mergedCount).toBe(3);
  });
});

describe("runCli leaves the destination untouched on every refusal it can reach — the union-invariant and gate-proof refusals sit after these on the same no-write path, and neither is reachable from the CLI seam (the invariant cannot be violated by parseable input, and the provenance guard needs a real audit path)", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "rin-gates-shard-cli-"));
  const UNTOUCHED = "SENTINEL — the destination must survive a refusal\n";

  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  const sandboxFile = (name: string, content: string): string => {
    const path = join(sandbox, name);
    writeFileSync(path, content, "utf-8");
    return path;
  };

  test("a successful merge writes the union to the destination and returns 0", () => {
    const ours = sandboxFile("ok-ours.md", shard([SESSION_START]));
    const theirs = sandboxFile("ok-theirs.md", shard([TELEMETRY]));
    const destination = sandboxFile("ok-out.md", UNTOUCHED);

    const exitCode = runCli([
      "--path",
      destination,
      "--ours",
      ours,
      "--theirs",
      theirs,
      "--out",
      destination,
    ]);

    expect(exitCode).toBe(0);
    expect(
      okValue(parseShard(readFileSync(destination, "utf-8"))),
    ).toHaveLength(2);
  });

  test("an unreadable side leaves the destination byte-identical", () => {
    const ours = sandboxFile("missing-ours.md", shard([SESSION_START]));
    const destination = sandboxFile("missing-out.md", UNTOUCHED);

    const exitCode = runCli([
      "--path",
      destination,
      "--ours",
      ours,
      "--theirs",
      join(sandbox, "absent.md"),
      "--out",
      destination,
    ]);

    expect(exitCode).toBe(1);
    expect(readFileSync(destination, "utf-8")).toBe(UNTOUCHED);
  });

  test("a side carrying conflict markers leaves the destination byte-identical", () => {
    const ours = sandboxFile(
      "marked-ours.md",
      `<<<<<<< HEAD\n${shard([SESSION_START])}`,
    );
    const theirs = sandboxFile("marked-theirs.md", shard([TELEMETRY]));
    const destination = sandboxFile("marked-out.md", UNTOUCHED);

    const exitCode = runCli([
      "--path",
      destination,
      "--ours",
      ours,
      "--theirs",
      theirs,
      "--out",
      destination,
    ]);

    expect(exitCode).toBe(1);
    expect(readFileSync(destination, "utf-8")).toBe(UNTOUCHED);
  });

  test("an unparseable side leaves the destination byte-identical", () => {
    const ours = sandboxFile("bad-ours.md", "no shard header here\n");
    const theirs = sandboxFile("bad-theirs.md", shard([TELEMETRY]));
    const destination = sandboxFile("bad-out.md", UNTOUCHED);

    const exitCode = runCli([
      "--path",
      destination,
      "--ours",
      ours,
      "--theirs",
      theirs,
      "--out",
      destination,
    ]);

    expect(exitCode).toBe(1);
    expect(readFileSync(destination, "utf-8")).toBe(UNTOUCHED);
  });
});

describe("the write is ordered after every guard — a structural pin, because the two late refusals are unreachable from the CLI seam", () => {
  const source = readFileSync(
    join(import.meta.dirname, "rin-gates-shard-merge.ts"),
    "utf-8",
  );
  const runCliBody = source.slice(source.indexOf("export const runCli"));

  test("the union-invariant guard appears before the only writeFileSync", () => {
    expect(
      runCliBody.indexOf("if (!summary.unionInvariantHolds)"),
    ).toBeLessThan(runCliBody.indexOf("writeFileSync(resolvedOutPath"));
  });

  test("the gate-proof provenance guard appears before the only writeFileSync", () => {
    expect(runCliBody.indexOf("if (!provenance.admissible)")).toBeLessThan(
      runCliBody.indexOf("writeFileSync(resolvedOutPath"),
    );
  });

  test("runCli writes to the destination exactly once", () => {
    expect(runCliBody.split("writeFileSync(resolvedOutPath")).toHaveLength(2);
  });
});

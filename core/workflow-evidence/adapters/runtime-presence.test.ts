import { expect, mock, test } from "bun:test";
import { createRuntimePresenceAdapter, type PresenceAssessment } from "./runtime-presence.ts";

test("translates predecessor event positions without inferring authority", () => {
  const assess = mock<PresenceAssessment["assess"]>().mockReturnValue({ kind: "missing" });
  const adapter = createRuntimePresenceAdapter({ assessment: { assess } });
  expect(adapter.inspect({ tracking: "active", events: [{ ts: "01", shard: 2, pos: 5, human: true }] })).toEqual({
    kind: "none", evidence: { kind: "missing" },
  });
  expect(assess).toHaveBeenCalledWith({ history: {
    kind: "observed", tracking: "active",
    events: [{ kind: "human-turn", timestamp: "01", shard: "2", position: 5 }],
  } });
});

test("preserves the predecessor untracked exemption without claiming a turn", () => {
  const assess = mock<PresenceAssessment["assess"]>().mockReturnValue({ kind: "untracked" });
  const adapter = createRuntimePresenceAdapter({ assessment: { assess } });
  expect(adapter.inspect({ tracking: "inactive", events: [] })).toEqual({ kind: "acted", evidence: { kind: "untracked" } });
});

test("maps unordered evidence to the upstream consumed state", () => {
  const assess = mock<PresenceAssessment["assess"]>().mockReturnValue({ kind: "unordered", turns: [], resolutions: [] });
  const adapter = createRuntimePresenceAdapter({ assessment: { assess } });
  expect(adapter.inspect({ tracking: "active", events: [] })).toEqual({ kind: "consumed", evidence: { kind: "unordered", turns: [], resolutions: [] } });
});

test("maps a fresh witness to the predecessor acted state", () => {
  const assess = mock<PresenceAssessment["assess"]>().mockReturnValue({ kind: "fresh", witness: { timestamp: "01", shard: "0", position: 1 } });
  const adapter = createRuntimePresenceAdapter({ assessment: { assess } });
  expect(adapter.inspect({ tracking: "active", events: [] }).kind).toBe("acted");
});

test("maps consumed evidence to the predecessor consumed state", () => {
  const assess = mock<PresenceAssessment["assess"]>().mockReturnValue({ kind: "consumed", boundaries: [{ timestamp: "01", shard: "0", position: 1 }] });
  const adapter = createRuntimePresenceAdapter({ assessment: { assess } });
  expect(adapter.inspect({ tracking: "active", events: [] }).kind).toBe("consumed");
});

test("maps unavailable evidence to the predecessor none state", () => {
  const assess = mock<PresenceAssessment["assess"]>().mockReturnValue({ kind: "unavailable", reason: "unreadable-shard" });
  const adapter = createRuntimePresenceAdapter({ assessment: { assess } });
  expect(adapter.inspect({ tracking: "active", events: [] }).kind).toBe("none");
});

test("preserves stable shard identity in modern evidence input", () => {
  const assess = mock<PresenceAssessment["assess"]>().mockReturnValue({ kind: "missing" });
  const adapter = createRuntimePresenceAdapter({ assessment: { assess } });
  adapter.inspect({ tracking: "active", events: [{ ts: "01", shard: "aidlc/audit/probe.md", pos: 5, human: true }] });
  expect(assess).toHaveBeenCalledWith({ history: {
    kind: "observed", tracking: "active",
    events: [{ kind: "human-turn", timestamp: "01", shard: "aidlc/audit/probe.md", position: 5 }],
  } });
});

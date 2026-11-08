import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { CHAT, RUNNING_RECORD } from "../fixtures/workflow-record.fixture.ts";
import {
  auditIntegrity,
  causeChain,
  effectsOf,
  transitionFacts,
  type AuditEvent,
} from "./audit.ts";
import { auditSequence } from "./identities.ts";

const AT = at("2026-11-08T10:00:00Z");
const sequence = (raw: number) => accept(auditSequence(raw));

const prompted: AuditEvent = {
  intent: RUNNING_RECORD.id,
  session: CHAT,
  at: AT,
  causedBy: null,
  sequence: sequence(1),
  fact: { kind: "host-event", point: "user-prompt" },
};

const parked: AuditEvent = {
  ...prompted,
  causedBy: sequence(1),
  sequence: sequence(2),
  fact: { kind: "transition", transition: { kind: "park", at: AT } },
};

const resumed: AuditEvent = {
  ...prompted,
  causedBy: sequence(2),
  sequence: sequence(3),
  fact: { kind: "transition", transition: { kind: "resume", at: AT } },
};

const unrelated: AuditEvent = {
  ...prompted,
  sequence: sequence(4),
  fact: { kind: "host-event", point: "stop" },
};

const trail: readonly AuditEvent[] = [prompted, parked, resumed, unrelated];

describe("transitionFacts", () => {
  test("states each transition as a fact", () => {
    expect(transitionFacts([{ kind: "park", at: AT }])).toEqual([
      { kind: "transition", transition: { kind: "park", at: AT } },
    ]);
  });
});

describe("causation", () => {
  test("effectsOf lists what an event caused directly", () => {
    expect(effectsOf(trail, sequence(1))).toEqual([parked]);
  });

  test("causeChain walks an event back to the root that started it", () => {
    expect(causeChain(trail, resumed)).toEqual([prompted, parked, resumed]);
  });
});

describe("auditIntegrity", () => {
  test("a trail in sequence with earlier causes is ordered", () => {
    expect(auditIntegrity(trail)).toEqual({ kind: "ordered" });
  });

  test("names the first event out of sequence", () => {
    expect(auditIntegrity([parked, prompted])).toEqual({ kind: "out-of-sequence", event: prompted });
  });

  test("names an event whose cause is not earlier than itself", () => {
    const selfCaused: AuditEvent = { ...unrelated, causedBy: sequence(4) };

    expect(auditIntegrity([prompted, selfCaused])).toEqual({
      kind: "cause-not-earlier",
      event: selfCaused,
    });
  });
});

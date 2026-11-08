import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { auditSequence } from "../domain/identities.ts";
import { memoryAuditLog } from "../fixtures/fakes.fixture.ts";
import { CHAT, RUNNING_RECORD } from "../fixtures/workflow-record.fixture.ts";
import { auditTrail } from "./audit-trail.ts";

const scene = { intent: RUNNING_RECORD.id, session: CHAT, at: at("2026-11-08T10:00:00Z") };

describe("auditTrail", () => {
  test("records one fact with no cause", async () => {
    const log = memoryAuditLog([]);

    expect(await auditTrail(log).record(scene, { kind: "host-event", point: "stop" })).toEqual({
      ...scene,
      causedBy: null,
      sequence: accept(auditSequence(1)),
      fact: { kind: "host-event", point: "stop" },
    });
  });

  test("records a cause, then each effect pointing back at it, in order", async () => {
    const log = memoryAuditLog([]);

    await auditTrail(log).recordCaused({
      scene,
      cause: { kind: "host-event", point: "user-prompt" },
      effects: [
        { kind: "transition", transition: { kind: "park", at: scene.at } },
        { kind: "transition", transition: { kind: "resume", at: scene.at } },
      ],
    });

    expect(log.events()).toMatchObject([
      { sequence: 1, causedBy: null, fact: { kind: "host-event" } },
      { sequence: 2, causedBy: 1, fact: { transition: { kind: "park" } } },
      { sequence: 3, causedBy: 1, fact: { transition: { kind: "resume" } } },
    ]);
  });

  test("records facts after an event already on the trail, as its effects", async () => {
    const log = memoryAuditLog([]);
    const trail = auditTrail(log);
    const observed = await trail.record(scene, { kind: "host-event", point: "stop" });

    await trail.recordAfter(observed, [{ kind: "transition", transition: { kind: "park", at: scene.at } }]);

    expect(log.events()).toMatchObject([
      { sequence: 1, causedBy: null },
      { ...scene, sequence: 2, causedBy: 1, fact: { transition: { kind: "park" } } },
    ]);
  });

  test("records facts with no single cause, in order", async () => {
    const log = memoryAuditLog([]);

    await auditTrail(log).recordAll(scene, [
      { kind: "host-event", point: "session-start" },
      { kind: "host-event", point: "user-prompt" },
    ]);

    expect(log.events()).toMatchObject([
      { sequence: 1, causedBy: null, fact: { point: "session-start" } },
      { sequence: 2, causedBy: null, fact: { point: "user-prompt" } },
    ]);
  });
});

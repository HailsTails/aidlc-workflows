import { describe, expect, test } from "bun:test";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import {
  CHAT,
  RUNNING_RECORD,
  sessionOf,
  stageOf,
  TURN_DIGEST,
  typedTurn,
  unitOf,
} from "./workflow-record.fixture.ts";

describe("execution identities", () => {
  test("build valid stage, Unit and chat identities", () => {
    expect([stageOf("code-generation"), unitOf("ledger"), sessionOf("chat-1")]).toEqual<
      readonly string[]
    >(["code-generation", "ledger", "chat-1"]);
  });

  test("throw for an invalid Unit name", () => {
    expect(() => unitOf("-ledger")).toThrow(
      'Fixture value refused: {"kind":"invalid-execution-identity","identity":"unit","raw":"-ledger"}',
    );
  });
});

describe("typedTurn", () => {
  test("is a turn the person typed in the fixture chat", () => {
    expect(typedTurn(at("2026-11-08T10:00:00Z"))).toEqual({
      session: CHAT,
      observedAt: at("2026-11-08T10:00:00Z"),
      source: "host-hook",
      turnDigest: TURN_DIGEST,
    });
  });
});

describe("RUNNING_RECORD", () => {
  test("is running and waits at the requirements gate", () => {
    expect([RUNNING_RECORD.status, RUNNING_RECORD.stages[1]]).toEqual([
      { kind: "running" },
      { stage: stageOf("requirements-analysis"), unit: null, progress: "awaiting-approval" },
    ]);
  });
});

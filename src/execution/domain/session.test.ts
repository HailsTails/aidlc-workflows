import { describe, expect, test } from "bun:test";
import { SESSION_BINDING_SOURCES } from "./session.ts";

describe("SESSION_BINDING_SOURCES", () => {
  test("lists every way a session can come to be bound, in order", () => {
    expect(SESSION_BINDING_SOURCES).toEqual([
      "create",
      "observed-create",
      "migration",
      "switch",
      "archive",
      "space-switch-cursor",
      "space-switch-lone",
      "space-switch-none",
      "worktree",
      "unit-claim",
      "cursor",
      "cursor-followed",
      "stamp",
      "unjoined",
      "none",
    ]);
  });
});

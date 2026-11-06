import { expect, test } from "bun:test";
import { projectionFixture } from "../../__tests__/projection-fixtures.ts";
import { cursorTarget } from "./cursor.ts";
test("Cursor refuses unsupported pinned model mappings explicitly", () => {
  expect(
    cursorTarget({ harness: "cursor", directory: ".cursor" }).render(
      projectionFixture({ nativeTier: { model: "sonnet", effort: "medium" } }),
    ),
  ).toMatchObject({ status: "invalid", findings: [{ code: "capability-gap" }] });
});
test("Cursor emits persona layout and sessionStart registration", () => {
  expect(
    cursorTarget({ harness: "cursor", directory: ".cursor" }).render(
      projectionFixture({
        harness: "cursor",
        harnessDir: ".cursor",
        nativeTier: { model: null, effort: null },
        hook: { event: "session-start", command: "echo Reviewer context: .cursor" },
      }),
    ),
  ).toEqual({
    status: "ok",
    value: [
      { kind: "file", path: ".cursor/aidlc/agents/reviewer.md", body: "Projected reviewer" },
      {
        kind: "registration",
        path: ".cursor/hooks/reviewer.json",
        body: '{"version":1,"hooks":{"sessionStart":[{"command":"echo Reviewer context: .cursor"}]}}',
      },
    ],
  });
});

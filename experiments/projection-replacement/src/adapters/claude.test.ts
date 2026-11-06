import { expect, test } from "bun:test";
import { projectionFixture as projected } from "../../__tests__/projection-fixtures.ts";
import { successful } from "../../__tests__/support.ts";
import { claudeTarget } from "./claude.ts";

test("Claude emits an authored description and mapped tier as native frontmatter", () => {
  expect(
    successful(
      claudeTarget({ harness: "claude", directory: ".claude" }).render(
        projected({ nativeTier: { model: "sonnet", effort: "medium" } }),
      ),
    )[0]?.body,
  ).toStartWith(
    '---\nname: "reviewer"\ndescription: "Review implementation evidence against the required rules."\nmodel: "sonnet"\neffort: "medium"\n---',
  );
});
test("Claude emits native SessionStart command wiring with projected hook context", () => {
  expect(
    successful(claudeTarget({ harness: "claude", directory: ".claude" }).render(projected()))[1],
  ).toEqual({
    kind: "registration",
    path: ".claude/hooks/reviewer.json",
    body: '{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"echo Reviewer context: .claude"}]}]}}',
  });
});
test.each([
  { kind: "core", id: "framework" },
  { kind: "plugin", id: "test-pro" },
] satisfies readonly import("../domain/model.ts").DocumentSource[])("Claude preserves native resources for $kind provenance", (source) => {
  expect(
    claudeTarget({ harness: "claude", directory: ".claude" }).render(projected({ source })),
  ).toEqual({
    status: "ok",
    value: [
      {
        kind: "file",
        path: ".claude/agents/reviewer.md",
        body: '---\nname: "reviewer"\ndescription: "Review implementation evidence against the required rules."\nmodel: "inherit"\n---\n\nProjected reviewer\n',
      },
      {
        kind: "registration",
        path: ".claude/hooks/reviewer.json",
        body: '{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"echo Reviewer context: .claude"}]}]}}',
      },
    ],
  });
});

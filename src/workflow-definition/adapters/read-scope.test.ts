import { accept } from "../../kernel/fixtures/accept.ts";
import { expect, test } from "bun:test";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { readScope } from "./read-scope.ts";

const source = { owner: { kind: "core" } as const,
  path: methodSource({ kind: "scope", within: "aidlc-feature.md" }) };
const raw = `---
name: feature
depth: Standard
keywords: []
description: Full lifecycle
runner: true
summary_confirmation: on
include_stages: [requirements-analysis]
freeform_default: true
---
# feature
`;

test("scope defaults and memberships are separate from scope metadata", () => {
  const admission = accept(readScope(source, raw));
  expect(admission.scope.runner).toBe("generated");
  expect(admission.scope.ceremony).toEqual({ "summary-confirmation": "on" });
  expect(admission.memberships).toEqual<readonly { scope: string; stage: string; declaredBy: {kind: string} }[]>([{ scope: "feature", stage: "requirements-analysis",
    declaredBy: { kind: "core" } }]);
  expect(admission.freeformDefaults).toEqual<readonly { scope: string; declaredBy: {kind: string} }[]>([{ scope: "feature",
    declaredBy: { kind: "core" } }]);
});

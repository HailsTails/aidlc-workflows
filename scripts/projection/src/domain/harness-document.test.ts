import { expect, test } from "bun:test";
import { renderHarnessDocument, harnessDocumentPlacements } from "./harness-document.ts";
import { entryMain, entryComposer, entryQuestion, entryMethod, entryMainOrigin, entryManifestOrigin, entryHelperOrigin } from "../../../../tests/unit/projection/support/__tests__/harness-document-fixtures.ts";
import { onboardingDocument, onboardingAuthoring } from "../../../../tests/unit/projection/support/__tests__/onboarding-fixtures.ts";

test("places prepared onboarding with its assembly provenance and no footer dependency", () => {
  expect(renderHarnessDocument({ document: onboardingDocument, context: { harness: "claude", directory: ".claude" } })).toEqual({ status: "ok", value: { origin: onboardingDocument.authored.origin, harness: "claude", authoring: onboardingAuthoring, resources: [{ kind: "file", path: ".claude/CLAUDE.md", body: "Run bun .claude/tools/aidlc.ts at .claude/rules/aidlc.md\n" }] } });
});

test.each([
  { document: entryMain, path: ".claude/skills/aidlc/SKILL.md", expectedText: "Rendered main\n\nNative compatibility\n" },
  { document: entryComposer, path: ".claude/skills/aidlc/composer.md", expectedText: "Rendered composer\n" },
  { document: entryQuestion, path: ".claude/skills/aidlc/question-rendering.md", expectedText: "Rendered question\n" },
  { document: entryMethod, path: ".claude/rules/aidlc.md", expectedText: "Rendered method\n" },
])("places $path as an authored document without registration", ({ document, path, expectedText }) => {
  expect(renderHarnessDocument({ document, context: { harness: "claude", directory: ".claude" } })).toEqual({ status: "ok", value: { origin: document.authored.origin, harness: "claude", authoring: [entryManifestOrigin, entryHelperOrigin], resources: [{ kind: "file", path, body: expectedText }] } });
});

test("other harnesses cannot reuse prepared Claude documents", () => {
  expect(renderHarnessDocument({ document: entryMain, context: { harness: "codex", directory: ".codex" } })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: entryMainOrigin.path, detail: "prepared harness documents require the same binding" }] });
});

test("the profile declares four distinct source mappings", () => {
  expect(harnessDocumentPlacements()).toEqual([
    { role: "main-skill", source: "skills/aidlc/SKILL.md", destination: "skills/aidlc/SKILL.md" },
    { role: "composer", source: "skills/aidlc/composer.md", destination: "skills/aidlc/composer.md" },
    { role: "question-rendering", source: "skills/aidlc/question-rendering.md", destination: "skills/aidlc/question-rendering.md" },
    { role: "method-import", source: "rules-aidlc.md", destination: "rules/aidlc.md" },
  ]);
});

import { expect, mock, test } from "bun:test";
import { createHarnessDocumentPreparer, createHarnessDocumentPreparationOperations } from "./harness-document-preparation.ts";
import { createEntryPreparationOperations, createEntryNativeText, createEntryProse, entryPreparation, entryDigest, entrySources, entryMain, entryComposer, entryQuestion, entryMethod, entryManifestOrigin, preparedEntries } from "../../__tests__/harness-document-fixtures.ts";

test("uses authored prose and the source-owned compatibility decision for each destination", async () => {
  const nativeText = createEntryNativeText();
  const operations = { ...createEntryPreparationOperations(), module: mock().mockResolvedValue({ status: "ok", value: { prepareEarlierReleaseSkillText: nativeText } }) };
  const prose = createEntryProse();
  expect(await createHarnessDocumentPreparer({ operations, prose }).prepare(entryPreparation)).toEqual({ status: "ok", value: preparedEntries });
  expect(nativeText.mock.calls).toEqual([[{ text: "Rendered main\n\n", skillRel: ".claude/skills/aidlc/SKILL.md", harnessDir: ".claude" }], [{ text: "Rendered composer\n", skillRel: ".claude/skills/aidlc/composer.md", harnessDir: ".claude" }], [{ text: "Rendered question\n", skillRel: ".claude/skills/aidlc/question-rendering.md", harnessDir: ".claude" }], [{ text: "Rendered method\n", skillRel: ".claude/rules/aidlc.md", harnessDir: ".claude" }]]);
  expect(prose.mock.calls).toEqual([
    [{ markdown: "Authored main\n\n", context: entryPreparation.context, subject: "harness/claude/skills/aidlc/SKILL.md" }],
    [{ markdown: "Authored composer\n", context: entryPreparation.context, subject: "harness/claude/skills/aidlc/composer.md" }],
    [{ markdown: "Authored question\n", context: entryPreparation.context, subject: "harness/claude/skills/aidlc/question-rendering.md" }],
    [{ markdown: "Authored method\n", context: entryPreparation.context, subject: "harness/claude/rules-aidlc.md" }],
  ]);
  expect(operations.module.mock.calls).toEqual([[{ sourceRoot: "entry-source", path: "scripts/earlier-release-regions.ts", sha256: entryDigest }]]);
  expect(operations.read.mock.calls).toEqual([[{ sourceRoot: "entry-source", path: "scripts/earlier-release-regions.ts" }], [{ sourceRoot: "entry-source", path: "scripts/earlier-release-regions.ts" }]]);
  expect(operations.digest.mock.calls).toEqual([[{ bytes: new Uint8Array([72]) }], [{ bytes: new Uint8Array([72]) }]]);
});

test("prose refusal prevents partial prepared output and passes its specific finding", async () => {
  const operations = createEntryPreparationOperations();
  const prose = mock().mockReturnValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "authored-prose", detail: "unknown authored token" }] });
  expect(await createHarnessDocumentPreparer({ operations, prose }).prepare({ ...entryPreparation, sources: { ...entrySources, documents: [{ ...entryMain.authored, text: "{{UNKNOWN}}" }] } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "authored-prose", detail: "unknown authored token" }] });
});

test.each([{ imported: {} }, { imported: { prepareEarlierReleaseSkillText: "yes" } }, { imported: { earlierReleasesReadSkill: mock().mockReturnValue(false) } }])("missing native capability refuses without prose execution", async ({ imported }) => {
  const operations = { ...createEntryPreparationOperations(), module: mock().mockResolvedValue({ status: "ok", value: imported }) };
  const prose = createEntryProse();
  expect(await createHarnessDocumentPreparer({ operations, prose }).prepare(entryPreparation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness-document-preparation", detail: "source-owned earlier release module must export its native text preparation capability" }] });
  expect(prose).not.toHaveBeenCalled();
});

test("a nonstring native result is refused rather than stringified", async () => {
  const operations = { ...createEntryPreparationOperations(), module: mock().mockResolvedValue({ status: "ok", value: { prepareEarlierReleaseSkillText: mock().mockReturnValue(false) } }) };
  expect(await createHarnessDocumentPreparer({ operations, prose: createEntryProse() }).prepare({ ...entryPreparation, sources: { ...entrySources, documents: [entryMain.authored] } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness-document-preparation", detail: "source-owned earlier-release preparation must return native document text" }] });
});
test("a revoked Native text capability refuses without a final helper read", async () => {
  const revoked = Proxy.revocable(createEntryNativeText(), {});
  revoked.revoke();
  const operations = { ...createEntryPreparationOperations(), module: mock().mockResolvedValue({ status: "ok", value: { prepareEarlierReleaseSkillText: revoked.proxy } }) };
  expect(await createHarnessDocumentPreparer({ operations, prose: createEntryProse() }).prepare({ ...entryPreparation, sources: { ...entrySources, documents: [entryMain.authored] } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness-document-preparation", detail: "source-owned earlier-release text preparation unavailable" }] });
  expect(operations.read.mock.calls).toEqual([[{ sourceRoot: "entry-source", path: "scripts/earlier-release-regions.ts" }]]);
});

test("unsupported authored tokens cannot bypass the prose renderer's known vocabulary", async () => {
  const nativeText = mock().mockReturnValue("silently changed");
  const operations = { ...createEntryPreparationOperations(), module: mock().mockResolvedValue({ status: "ok", value: { prepareEarlierReleaseSkillText: nativeText } }) };
  const prose = mock().mockReturnValue({ status: "ok", value: "Use {{UNKNOWN}}" });
  expect(await createHarnessDocumentPreparer({ operations, prose }).prepare({ ...entryPreparation, sources: { ...entrySources, documents: [entryMain.authored] } })).toEqual({ status: "invalid", findings: [{ code: "unresolved-token", subject: "harness/claude/skills/aidlc/SKILL.md", detail: "unsupported authored entry token {{UNKNOWN}}" }] });
  expect(nativeText).not.toHaveBeenCalled();
});

test("helper changes during preparation refuse the prepared bytes", async () => {
  const operations = { ...createEntryPreparationOperations(), digest: mock().mockReturnValueOnce(entryDigest).mockReturnValue("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc") };
  expect(await createHarnessDocumentPreparer({ operations, prose: createEntryProse() }).prepare(entryPreparation)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "harness-document-preparation", detail: "earlier-release policy changed during entry document preparation" }] });
});

test.each([{ context: { harness: "claude", directory: ".claude", invocation: "aidlc", rulesSubdir: "rules" } }, { context: { harness: "codex", directory: ".codex", invocation: "bun .codex/tools/aidlc.ts", rulesSubdir: "rules" } }] as const)("unqualified delivery refuses before helper access", async ({ context }) => {
  const operations = createEntryPreparationOperations();
  expect(await createHarnessDocumentPreparer({ operations }).prepare({ ...entryPreparation, context })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "harness-document-preparation", detail: "authored entry document preparation qualifies explicit Claude Bun-copy invocation only" }] });
  expect(operations.read).not.toHaveBeenCalled();
});

test("source helper unavailability remains an explicit failure", async () => {
  const operations = { ...createEntryPreparationOperations(), module: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/earlier-release-regions.ts", detail: "native helper module unavailable" }] }) };
  expect(await createHarnessDocumentPreparer({ operations }).prepare(entryPreparation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/earlier-release-regions.ts", detail: "native helper module unavailable" }] });
  expect(operations.read).toHaveBeenCalledTimes(1);
});

test("helper source read refusal stops module loading and prose preparation", async () => {
  const operations = { ...createEntryPreparationOperations(), read: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/earlier-release-regions.ts", detail: "native helper source unavailable" }] }) };
  const prose = createEntryProse();
  expect(await createHarnessDocumentPreparer({ operations, prose }).prepare(entryPreparation)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/earlier-release-regions.ts", detail: "native helper source unavailable" }] });
  expect(operations.module).not.toHaveBeenCalled();
  expect(prose).not.toHaveBeenCalled();
});

test.each([
  { name: "authored document pin", sources: { ...entrySources, documents: [{ ...entryMain.authored, origin: { ...entryMain.authored.origin, pin: "foreign" } }, entryComposer.authored, entryQuestion.authored, entryMethod.authored] } },
  { name: "authored document source identity", sources: { ...entrySources, documents: [{ ...entryMain.authored, origin: { ...entryMain.authored.origin, source: { kind: "core", id: "other" } } }, entryComposer.authored, entryQuestion.authored, entryMethod.authored] } },
  { name: "manifest pin", sources: { ...entrySources, authoring: [{ ...entryManifestOrigin, pin: "foreign" }] } },
  { name: "manifest source kind", sources: { ...entrySources, authoring: [{ ...entryManifestOrigin, source: { kind: "plugin", id: "rin" } }] } },
] as const)("$name disagreement refuses before helper access", async ({ sources }) => {
  const operations = createEntryPreparationOperations();
  const prose = createEntryProse();
  expect(await createHarnessDocumentPreparer({ operations, prose }).prepare({ ...entryPreparation, sources })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "harness-document-preparation", detail: "entry documents and manifest provenance must retain the requested framework source basis" }] });
  expect(operations.read).not.toHaveBeenCalled();
  expect(operations.module).not.toHaveBeenCalled();
  expect(operations.digest).not.toHaveBeenCalled();
  expect(prose).not.toHaveBeenCalled();
});

test("the production preparation factory supplies source IO and digest ports", () => {
  expect(createHarnessDocumentPreparationOperations()).toEqual({ read: expect.any(Function), module: expect.any(Function), digest: expect.any(Function) });
});

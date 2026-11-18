import { assertDefined } from "../kernel/fixtures/defined.ts";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";

import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../kernel/result.ts";
import { accept } from "../kernel/fixtures/accept.ts";
import { path, source } from "../kernel/fixtures/values.fixture.ts";
import type { FileContent } from "../kernel/file-content.ts";
import type { AuthoredPlacement } from "../projection/domain/host-surface.ts";
import type { DistributionChannel, ProjectedFile } from "../projection/domain/projected-file.ts";
import type { NativeCommandRoutes } from "../projection/domain/native-command.ts";
import { tokenBindingsFixture } from "../projection/fixtures/token-bindings.fixture.ts";
import { cursorHost } from "../hosts/cursor/host.ts";
import { createHostSurfaceMembers } from "../projection/application/host-surface-members.ts";
import { prepareHostSource } from "../projection/application/prepared-host-source.ts";
import { bindCopiedSource } from "../projection/domain/source-binding.ts";
import { nativeLayoutFiles } from "../packaging/application/native-layout.ts";

const module = accept(cursorHost());
const release = accept(module.distribution()).native;
const origin = { kind: "harness-authored" as const, source: source("rules-aidlc.mdc") };
const missing = refused([{ kind: "native-text-not-found" as const, distribution: module.host.distribution,
  text: "run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found)," }]);
const tokens = tokenBindingsFixture({ harnessDir: ".cursor" });
const routes = (unresolvable: NativeCommandRoutes["unresolvable"]): NativeCommandRoutes => ({
  prefix: "aidlc engine", namespace: "engine", delegates: [], adapterHooks: new Set(),
  trusted: (suffix) => `aidlc engine ${suffix}`, unresolvable,
});
const layout = (files: readonly ProjectedFile[]) => nativeLayoutFiles({ files, release,
  host: module.host, routes: routes(() => []) });
const placeDeclared = ({ content, channel, placements }: { readonly content: FileContent;
  readonly channel: DistributionChannel; readonly placements: readonly AuthoredPlacement[] }) => accept(createHostSurfaceMembers({
  host: module.host, data: module.projection.renderData(),
  record: module.projection.record, placements, tokens, channel,
  prepare: (file) => prepareHostSource({ host: module.host, file,
    steps: [(prepared) => bindCopiedSource({ source: file.source, content: prepared, tokens })] }),
}).placeAuthoredFile({ file: { source: origin.source, content } }));
const place = (content: FileContent, channel: DistributionChannel) => placeDeclared({ content, channel,
  placements: module.projection.placements });


const copyLF = "---\ndescription: AI-DLC standing practices for this workspace\nalwaysApply: true\n---\n\n<!--\n  .cursor/rules/aidlc.mdc: the always-applied AIDLC standing-practice rule (a\n  READ instruction, not a copy). The AI-DLC method is authored ONCE at the\n  workspace root under aidlc/spaces/<space>/memory/, the single hand-editable\n  source of truth, identical on every harness.\n\n  Cursor rules do not expand @-import lines (live-verified), so unlike the\n  Claude harness stub this rule cannot inline the method files by reference.\n  Instead it instructs the agent to read the standing org/team/project layers.\n  The four phase pointers beside this file are agent-decided rules, so phase\n  guidance is loaded when relevant instead of on every Cursor turn. The paths\n  name aidlc/active-memory/, AI-DLC's git-ignored copy of the ACTIVE\n  space's memory files, which the engine writes at session start, on a space\n  switch, and with each step whose rules it sends; so these rule files are the\n  same for every teammate and never change after install.\n\n  Edit the METHOD at aidlc/spaces/<space>/memory/*, never here and never in\n  the copy.\n-->\n\nThis workspace uses the AI-DLC method. Its standing practices are the layered\nfiles listed below (org -> team -> project; strict-additive). Read them before\nacting on AIDLC work, and honour them in casual chat that touches process,\npractices, or workflow questions:\n\n- aidlc/active-memory/org.md\n- aidlc/active-memory/team.md\n- aidlc/active-memory/project.md\n\nIf every tool call here is refused before it runs, AI-DLC cannot start in\nthis Cursor window, and nothing you retry will get through. Stop and tell the\nperson, in one message: open a terminal in this folder and\nrun `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),\nwhose Runtime hook PATH line names what to fix. Then quit Cursor fully and\nopen this folder again.\n";
const copyCRLF = "---\r\ndescription: AI-DLC standing practices for this workspace\r\nalwaysApply: true\r\n---\r\n\r\n<!--\r\n  .cursor/rules/aidlc.mdc: the always-applied AIDLC standing-practice rule (a\r\n  READ instruction, not a copy). The AI-DLC method is authored ONCE at the\r\n  workspace root under aidlc/spaces/<space>/memory/, the single hand-editable\r\n  source of truth, identical on every harness.\r\n\r\n  Cursor rules do not expand @-import lines (live-verified), so unlike the\r\n  Claude harness stub this rule cannot inline the method files by reference.\r\n  Instead it instructs the agent to read the standing org/team/project layers.\r\n  The four phase pointers beside this file are agent-decided rules, so phase\r\n  guidance is loaded when relevant instead of on every Cursor turn. The paths\r\n  name aidlc/active-memory/, AI-DLC's git-ignored copy of the ACTIVE\r\n  space's memory files, which the engine writes at session start, on a space\r\n  switch, and with each step whose rules it sends; so these rule files are the\r\n  same for every teammate and never change after install.\r\n\r\n  Edit the METHOD at aidlc/spaces/<space>/memory/*, never here and never in\r\n  the copy.\r\n-->\r\n\r\nThis workspace uses the AI-DLC method. Its standing practices are the layered\r\nfiles listed below (org -> team -> project; strict-additive). Read them before\r\nacting on AIDLC work, and honour them in casual chat that touches process,\r\npractices, or workflow questions:\r\n\r\n- aidlc/active-memory/org.md\r\n- aidlc/active-memory/team.md\r\n- aidlc/active-memory/project.md\r\n\r\nIf every tool call here is refused before it runs, AI-DLC cannot start in\r\nthis Cursor window, and nothing you retry will get through. Stop and tell the\r\nperson, in one message: open a terminal in this folder and\r\nrun `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),\r\nwhose Runtime hook PATH line names what to fix. Then quit Cursor fully and\r\nopen this folder again.\r\n";
const nativeLF = "---\ndescription: AI-DLC standing practices for this workspace\nalwaysApply: true\n---\n\n<!--\n  .cursor/rules/aidlc.mdc: the always-applied AIDLC standing-practice rule (a\n  READ instruction, not a copy). The AI-DLC method is authored ONCE at the\n  workspace root under aidlc/spaces/<space>/memory/, the single hand-editable\n  source of truth, identical on every harness.\n\n  Cursor rules do not expand @-import lines (live-verified), so unlike the\n  Claude harness stub this rule cannot inline the method files by reference.\n  Instead it instructs the agent to read the standing org/team/project layers.\n  The four phase pointers beside this file are agent-decided rules, so phase\n  guidance is loaded when relevant instead of on every Cursor turn. The paths\n  name aidlc/active-memory/, AI-DLC's git-ignored copy of the ACTIVE\n  space's memory files, which the engine writes at session start, on a space\n  switch, and with each step whose rules it sends; so these rule files are the\n  same for every teammate and never change after install.\n\n  Edit the METHOD at aidlc/spaces/<space>/memory/*, never here and never in\n  the copy.\n-->\n\nThis workspace uses the AI-DLC method. Its standing practices are the layered\nfiles listed below (org -> team -> project; strict-additive). Read them before\nacting on AIDLC work, and honour them in casual chat that touches process,\npractices, or workflow questions:\n\n- aidlc/active-memory/org.md\n- aidlc/active-memory/team.md\n- aidlc/active-memory/project.md\n\nIf every tool call here is refused before it runs, AI-DLC cannot start in\nthis Cursor window, and nothing you retry will get through. Stop and tell the\nperson, in one message: open a terminal in this folder and\nrun `aidlc doctor`,\nwhose Runtime hook PATH line names what to fix. Then quit Cursor fully and\nopen this folder again.\n";
const nativeCRLF = "---\r\ndescription: AI-DLC standing practices for this workspace\r\nalwaysApply: true\r\n---\r\n\r\n<!--\r\n  .cursor/rules/aidlc.mdc: the always-applied AIDLC standing-practice rule (a\r\n  READ instruction, not a copy). The AI-DLC method is authored ONCE at the\r\n  workspace root under aidlc/spaces/<space>/memory/, the single hand-editable\r\n  source of truth, identical on every harness.\r\n\r\n  Cursor rules do not expand @-import lines (live-verified), so unlike the\r\n  Claude harness stub this rule cannot inline the method files by reference.\r\n  Instead it instructs the agent to read the standing org/team/project layers.\r\n  The four phase pointers beside this file are agent-decided rules, so phase\r\n  guidance is loaded when relevant instead of on every Cursor turn. The paths\r\n  name aidlc/active-memory/, AI-DLC's git-ignored copy of the ACTIVE\r\n  space's memory files, which the engine writes at session start, on a space\r\n  switch, and with each step whose rules it sends; so these rule files are the\r\n  same for every teammate and never change after install.\r\n\r\n  Edit the METHOD at aidlc/spaces/<space>/memory/*, never here and never in\r\n  the copy.\r\n-->\r\n\r\nThis workspace uses the AI-DLC method. Its standing practices are the layered\r\nfiles listed below (org -> team -> project; strict-additive). Read them before\r\nacting on AIDLC work, and honour them in casual chat that touches process,\r\npractices, or workflow questions:\r\n\r\n- aidlc/active-memory/org.md\r\n- aidlc/active-memory/team.md\r\n- aidlc/active-memory/project.md\r\n\r\nIf every tool call here is refused before it runs, AI-DLC cannot start in\r\nthis Cursor window, and nothing you retry will get through. Stop and tell the\r\nperson, in one message: open a terminal in this folder and\r\nrun `aidlc doctor`,\r\nwhose Runtime hook PATH line names what to fix. Then quit Cursor fully and\r\nopen this folder again.\r\n";
const authoredLF = "---\ndescription: AI-DLC standing practices for this workspace\nalwaysApply: true\n---\n\n<!--\n  .cursor/rules/aidlc.mdc: the always-applied AIDLC standing-practice rule (a\n  READ instruction, not a copy). The AI-DLC method is authored ONCE at the\n  workspace root under aidlc/spaces/<space>/memory/, the single hand-editable\n  source of truth, identical on every harness.\n\n  Cursor rules do not expand @-import lines (live-verified), so unlike the\n  Claude harness stub this rule cannot inline the method files by reference.\n  Instead it instructs the agent to read the standing org/team/project layers.\n  The four phase pointers beside this file are agent-decided rules, so phase\n  guidance is loaded when relevant instead of on every Cursor turn. The paths\n  name aidlc/active-memory/, AI-DLC's git-ignored copy of the ACTIVE\n  space's memory files, which the engine writes at session start, on a space\n  switch, and with each step whose rules it sends; so these rule files are the\n  same for every teammate and never change after install.\n\n  Edit the METHOD at aidlc/spaces/<space>/memory/*, never here and never in\n  the copy.\n-->\n\nThis workspace uses the AI-DLC method. Its standing practices are the layered\nfiles listed below (org -> team -> project; strict-additive). Read them before\nacting on AIDLC work, and honour them in casual chat that touches process,\npractices, or workflow questions:\n\n- aidlc/active-memory/org.md\n- aidlc/active-memory/team.md\n- aidlc/active-memory/project.md\n\nIf every tool call here is refused before it runs, AI-DLC cannot start in\nthis Cursor window, and nothing you retry will get through. Stop and tell the\nperson, in one message: open a terminal in this folder and\n{{SLOT:cursor_doctor_guidance}}\nwhose Runtime hook PATH line names what to fix. Then quit Cursor fully and\nopen this folder again.\n";
const authoredCRLF = "---\r\ndescription: AI-DLC standing practices for this workspace\r\nalwaysApply: true\r\n---\r\n\r\n<!--\r\n  .cursor/rules/aidlc.mdc: the always-applied AIDLC standing-practice rule (a\r\n  READ instruction, not a copy). The AI-DLC method is authored ONCE at the\r\n  workspace root under aidlc/spaces/<space>/memory/, the single hand-editable\r\n  source of truth, identical on every harness.\r\n\r\n  Cursor rules do not expand @-import lines (live-verified), so unlike the\r\n  Claude harness stub this rule cannot inline the method files by reference.\r\n  Instead it instructs the agent to read the standing org/team/project layers.\r\n  The four phase pointers beside this file are agent-decided rules, so phase\r\n  guidance is loaded when relevant instead of on every Cursor turn. The paths\r\n  name aidlc/active-memory/, AI-DLC's git-ignored copy of the ACTIVE\r\n  space's memory files, which the engine writes at session start, on a space\r\n  switch, and with each step whose rules it sends; so these rule files are the\r\n  same for every teammate and never change after install.\r\n\r\n  Edit the METHOD at aidlc/spaces/<space>/memory/*, never here and never in\r\n  the copy.\r\n-->\r\n\r\nThis workspace uses the AI-DLC method. Its standing practices are the layered\r\nfiles listed below (org -> team -> project; strict-additive). Read them before\r\nacting on AIDLC work, and honour them in casual chat that touches process,\r\npractices, or workflow questions:\r\n\r\n- aidlc/active-memory/org.md\r\n- aidlc/active-memory/team.md\r\n- aidlc/active-memory/project.md\r\n\r\nIf every tool call here is refused before it runs, AI-DLC cannot start in\r\nthis Cursor window, and nothing you retry will get through. Stop and tell the\r\nperson, in one message: open a terminal in this folder and\r\n{{SLOT:cursor_doctor_guidance}}\r\nwhose Runtime hook PATH line names what to fix. Then quit Cursor fully and\r\nopen this folder again.\r\n";

const capturedFile = new URL("file:///C:/q199-cursor/rules-aidlc.mdc");
const capturedFiles = createInMemoryFileSystem({ files: { [capturedFile.href]: authoredLF } });
const captured = accept(await capturedFiles.readFile({ file: capturedFile }));

test("the captured source fixture declares exactly the known doctor position", () => {
  expect(captured).toEqual({ kind: "bytes", bytes: new TextEncoder().encode(authoredLF) });
  expect(layout(place(captured, "native"))).toEqual(accepted([{
    path: path(".cursor/rules/aidlc.mdc"), content: { kind: "text", text: nativeLF }, mode: "regular", origin,
  }]));
});

test.each([
  { ending: "LF", input: authoredLF, expected: copyLF },
  { ending: "CRLF", input: authoredCRLF, expected: copyCRLF },
])("copy composition preserves complete $ending authoring and provenance", ({ input, expected }) => {
  expect(place({ kind: "text", text: input }, "copy")).toEqual([{
    path: path(".cursor/rules/aidlc.mdc"), content: { kind: "text", text: expected }, mode: "regular", origin,
  }]);
});

test.each([
  { ending: "LF", input: authoredLF, expected: nativeLF },
  { ending: "CRLF", input: authoredCRLF, expected: nativeCRLF },
])("native owner/serializer/admission preserves complete $ending output", ({ input, expected }) => {
  expect(layout(place({ kind: "text", text: input }, "native"))).toEqual(accepted([{
    path: path(".cursor/rules/aidlc.mdc"), content: { kind: "text", text: expected }, mode: "regular", origin,
  }]));
});

test("producer text without the real serializer receipt still fails mandatory presence", () => {
  expect(layout([{ path: path(".cursor/rules/aidlc.mdc"), content: { kind: "text", text: nativeLF },
    mode: "regular", origin }])).toEqual(missing);
});

test.each([
  { name: "missing", text: "No doctor declaration" },
  { name: "native-looking", text: "run `aidlc doctor`," },
  { name: "duplicate", text: "{{SLOT:cursor_doctor_guidance}}\n{{SLOT:cursor_doctor_guidance}}" },
  { name: "malformed", text: "{{SLOT:cursor_doctor_guidance}" },
  { name: "stale", text: "{{SLOT:cursor_doctor_guidance_v0}}" },
])("$name source cannot discharge the required passage", ({ text }) => {
  expect(layout(place({ kind: "text", text }, "native"))).toEqual(missing);
});

test("custom legacy passage retains exact global compatibility without owner admission", () => {
  expect(layout(place({ kind: "text", text: "Opaque quote: run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),\n" }, "native")))
    .toEqual(accepted([{ path: path(".cursor/rules/aidlc.mdc"),
      content: { kind: "text", text: "Opaque quote: run `aidlc doctor`,\n" }, mode: "regular", origin }]));
});

test("a malformed declaration does not revoke legacy custom-passage compatibility", () => {
  expect(layout(place({ kind: "text", text: "{{SLOT:cursor_doctor_guidance_v0}}\nOpaque quote: run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),\n" }, "native")))
    .toEqual(accepted([{ path: path(".cursor/rules/aidlc.mdc"),
      content: { kind: "text", text: "{{SLOT:cursor_doctor_guidance_v0}}\nOpaque quote: run `aidlc doctor`,\n" }, mode: "regular", origin }]));
});

test("an undeclared placement cannot borrow authority from the filename and slot", () => {
  expect(layout(placeDeclared({ content: { kind: "text", text: authoredLF }, channel: "native", placements: [{
    source: "rules-aidlc.mdc", destination: ".cursor/rules/aidlc.mdc",
  }] }))).toEqual(missing);
});

test.each([
  { path: path(".cursor/rules/moved.mdc") },
  { mode: "executable" as const },
  { content: { kind: "text" as const, text: "run `aidlc doctor`," } },
])("stale serialized metadata cannot discharge presence: %j", (changed) => {
  const [file] = place({ kind: "text", text: authoredLF }, "native");
  assertDefined(file);
  expect(layout([{ ...file, ...changed }])).toEqual(missing);
});

test("copy-only filtering still precedes admission", () => {
  const [file] = place({ kind: "text", text: authoredLF }, "native");
  assertDefined(file);
  expect(nativeLayoutFiles({ host: module.host, routes: routes(() => []),
    release: { ...release, copyOnly: [path(".cursor/rules/aidlc.mdc")] }, files: [file] })).toEqual(missing);
});

test("an ineligible output extension cannot carry the obligation", () => {
  const [placement] = module.projection.placements;
  assertDefined(placement);
  expect(layout(placeDeclared({ content: { kind: "text", text: authoredLF }, channel: "native", placements: [{
    ...placement, destination: ".cursor/rules/aidlc.bin",
  }] }))).toEqual(missing);
});

test("admitted target text retains exact masking before route validation", () => {
  const unresolvable = mock<NativeCommandRoutes["unresolvable"]>().mockReturnValue([]);
  expect(nativeLayoutFiles({ host: module.host, release, routes: routes(unresolvable),
    files: place({ kind: "text", text: "Before\n{{SLOT:cursor_doctor_guidance}}\nAfter\n" }, "native"),
  })).toEqual(accepted([{ path: path(".cursor/rules/aidlc.mdc"),
    content: { kind: "text", text: "Before\nrun `aidlc doctor`,\nAfter\n" }, mode: "regular", origin }]));
  expect(unresolvable).toHaveBeenCalledTimes(1);
  expect(unresolvable).toHaveBeenCalledWith({ file: ".cursor/rules/aidlc.mdc", text: "Before\n\nAfter\n" });
});

test("an unrelated route refusal is preserved after the admitted passage is masked", () => {
  const unresolvable = mock<NativeCommandRoutes["unresolvable"]>().mockReturnValue(["unresolved fixture route"]);
  expect(nativeLayoutFiles({ host: module.host, release, routes: routes(unresolvable),
    files: place({ kind: "text", text: "{{SLOT:cursor_doctor_guidance}}\nOther command\n" }, "native"),
  })).toEqual(refused([{ kind: "native-leftover", path: path(".cursor/rules/aidlc.mdc"),
    reason: "unresolved fixture route" }]));
  expect(unresolvable).toHaveBeenCalledWith({ file: ".cursor/rules/aidlc.mdc", text: "\nOther command\n" });
});

test("the actual byte-backed capture is serialized and admitted without losing its origin", () => {
  expect(layout(place({ kind: "bytes", bytes: new Uint8Array([123,123,83,76,79,84,58,99,117,114,115,111,114,95,100,111,99,116,111,114,95,103,117,105,100,97,110,99,101,125,125]) }, "native"))).toEqual(accepted([{
    path: path(".cursor/rules/aidlc.mdc"), content: { kind: "text", text: "run `aidlc doctor`," }, mode: "regular", origin,
  }]));
});

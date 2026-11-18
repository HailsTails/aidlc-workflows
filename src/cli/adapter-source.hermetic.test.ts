import { expect, mock, test } from "bun:test";
import { createNodeFileSystem } from "../kernel/file-system.ts";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../kernel/fixtures/process-runner.fake.ts";
import { accept } from "../kernel/fixtures/accept.ts";
import { assertDefined } from "../kernel/fixtures/defined.ts";
import { source } from "../kernel/fixtures/values.fixture.ts";
import { refused } from "../kernel/result.ts";
import { createBuildProjection, createCapturedHostSourcePreparation } from "../projection/core-root.ts";
import { createRecordingPluginProjector } from "../projection/fixtures/plugin-projector.fake.ts";
import { createHostSurfaceMembers } from "../projection/application/host-surface-members.ts";
import { prepareHostSource } from "../projection/application/prepared-host-source.ts";
import { bindCopiedSource } from "../projection/domain/source-binding.ts";
import { channelTokens } from "../packaging/domain/channel-tokens.ts";
import { nativeLayoutFiles } from "../packaging/application/native-layout.ts";
import { legacyInvocationSourceFixture } from "../projection/fixtures/legacy-authoring.fixture.ts";
import { HOSTS } from "./host-table.ts";
import type { AuthoredFilePreparer } from "../projection/application/ports/host-sources.ts";
import type { FileContent } from "../kernel/file-content.ts";
import type { Rendering } from "../projection/application/ports/harness.ts";
import type { ProjectedFile } from "../projection/domain/projected-file.ts";

const fileSystem = createNodeFileSystem();
const unused = createInMemoryFileSystem({ files: {} });
const projection = createBuildProjection({ hostFiles: unused, sessionFiles: unused, runnerScratch: unused,
  runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "No child" }) }),
  runnerFrames: new URL("file:///C:/unused-frames/"), runnerChild: new URL("file:///C:/unused-child.ts"),
  plugins: createRecordingPluginProjector() });
const commands = projection.nativeCommands;
const cases = [
  { name: "codex", expected: "//   aidlc engine adapter codex <target>" },
  { name: "cursor", expected: "//   aidlc engine adapter cursor <target>" },
  { name: "kiro", expected: "//   aidlc engine adapter kiro <target>" },
  { name: "kiro-ide", expected: "//   aidlc engine adapter kiro-ide <target>" },
];
const bytes = (content: FileContent): Uint8Array => content.kind === "bytes" ? content.bytes
  : new TextEncoder().encode(content.text);

test.each(cases)("$name declared adapter source owns its whole copy/native bytes before file placement", async ({ name, expected }) => {
  const member = HOSTS.find(candidate => candidate.host.distribution === name);
  if (!member) throw new Error(`The actual host must be registered: ${name}`);
  const placement = member.projection.placements.find(candidate => candidate.sourceRole === "host-adapter-script");
  if (!placement) throw new Error(`The adapter source must have an owning declaration: ${name}`);
  const content = accept(await fileSystem.readFile({ file: new URL(`../../harness/${name}/${placement.source}`, import.meta.url) }));
  const captured = { source: source(placement.source), content };
  const capturedBytes = new Uint8Array(bytes(content));
  for (const channel of ["copy", "native"] as const) {
    const tokens = { ...member.projection.tokens, ["HARNESS_DIR"]: member.host.directory,
      ...channelTokens({ channel, directory: member.host.directory, prefix: commands.prefix, namespace: commands.namespace }) };
    const place = (prepare: AuthoredFilePreparer): Rendering => createHostSurfaceMembers({ host: member.host,
      legacyNative: channel === "copy" ? undefined : { host: member.host, commands,
        permissions: { kind: "authored" }, replacements: [] },
      data: member.projection.renderData({ delegateShellFacts: projection.delegateShellFacts }),
      record: member.projection.record, placements: member.projection.placements, tokens, channel, prepare,
    }).placeAuthoredFile({ file: captured });
    const previous = place(file => prepareHostSource({ host: member.host, file,
      steps: [content => bindCopiedSource({ source: file.source, content, tokens })] }));
    const trusted = mock(commands.trusted);
    const prepared = place(createCapturedHostSourcePreparation({ host: member.host,
      placements: member.projection.placements, channel, tokens, commands: { ...commands, trusted } }));
    const beforeFiles = accept(previous);
    const newFiles = accept(prepared);
    if (channel === "copy") {
      expect(prepared).toEqual(previous);
      expect(trusted).not.toHaveBeenCalled();
    } else {
      expect(trusted).toHaveBeenCalledWith(`adapter ${name}`);
      expect(newFiles[0]?.content.kind).toBe("text");
      const output = newFiles[0]?.content;
      if (output?.kind !== "text") throw new Error("The prepared adapter must have its channel spelling.");
      expect(output.text).toContain(expected);
      const release = { copyOnly: [], replacements: [], permissions: { kind: "authored" as const } };
      const oldFinal = nativeLayoutFiles({ host: member.host, routes: commands, release, files: beforeFiles });
      const lateRewrite = mock(commands.trusted);
      expect(legacyInvocationSourceFixture({ text: output.text, host: member.host, routes: commands })).toBe(output.text);
      const newFinal = nativeLayoutFiles({ host: member.host, routes: { ...commands, trusted: lateRewrite }, release, files: newFiles });
      expect(newFinal).toEqual(oldFinal);
      expect(newFinal.ok).toBe(true);
      expect(lateRewrite).not.toHaveBeenCalled();
    }
    const output: readonly ProjectedFile[] = channel === "copy" ? newFiles : accept(nativeLayoutFiles({ host: member.host, routes: commands,
      release: { copyOnly: [], replacements: [], permissions: { kind: "authored" } }, files: newFiles }));
    const reference = accept(await fileSystem.readFile({ file: new URL(
      `../../${channel === "copy" ? "dist" : "dist-release"}/${name}/${placement.destination}`, import.meta.url) }));
    const [producedFile] = output;
    assertDefined(producedFile);
    expect(bytes(producedFile.content)).toEqual(bytes(reference));
  }
  expect(bytes(captured.content)).toEqual(capturedBytes);
});

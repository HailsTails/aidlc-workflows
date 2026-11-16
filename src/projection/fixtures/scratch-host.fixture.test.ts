import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { path } from "../../kernel/fixtures/values.fixture.ts";
import { commandFilePath, nativeCommandName } from "../domain/native-command.ts";
import { documentRenderingInputsFixture, stageDocumentFixture } from "./document-rendering.fixture.ts";
import {
  SCRATCH_AGENT_INPUTS,
  scratchAgentRenderer,
  scratchCommandPlacement,
  scratchDocumentRenderer,
} from "./scratch-host.fixture.ts";

describe("scratch host fixtures", () => {
  test("place a command inside the scratch folder", () => {
    expect(scratchCommandPlacement({
      name: accept(nativeCommandName("aidlc-status")),
      within: accept(commandFilePath("aidlc-status.md")),
      content: { kind: "text", text: "status\n" },
      mode: "regular",
    })).toEqual({ ok: true, value: path(".scratch/commands/aidlc-status.md") });
  });

  test("render no conductor agent", () => {
    expect(scratchAgentRenderer(SCRATCH_AGENT_INPUTS).renderConductorAgent({ knowledge: [] }))
      .toEqual({ ok: true, value: [] });
  });

  test("place no neutral document", () => {
    expect(scratchDocumentRenderer(documentRenderingInputsFixture({ harnessDir: ".scratch" }))
      .placeNeutralDocument({ document: stageDocumentFixture() })).toEqual({ ok: true, value: [] });
  });
});

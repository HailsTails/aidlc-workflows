import { expect, test } from "bun:test";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../../kernel/result.ts";
import type { ProjectedFile } from "../../../projection/domain/projected-file.ts";
import { deriveKiroIdeHarnessRecord, KIRO_IDE_LAYOUT } from "./harness-record.ts";

const record = (text: string): ProjectedFile => ({ path: path(".kiro/tools/data/harness.json"),
  content: { kind: "text", text }, mode: "regular", availability: "always",
  origin: { kind: "rendered", concept: "host-data", name: "kiro" } });

test("Kiro IDE supplies its layout", () => {
  expect(KIRO_IDE_LAYOUT).toBe("kas");
});

test("Kiro IDE writes its layout line where the projection wrote it before", () => {
  expect(deriveKiroIdeHarnessRecord({ files: [record('{\n  "newChatStep": 1,\n  "hostShell": 2\n}\n')] }))
    .toEqual(accepted([record('{\n  "newChatStep": 1,\n  "kiroLayout": "kas",\n  "hostShell": 2\n}\n')]));
});

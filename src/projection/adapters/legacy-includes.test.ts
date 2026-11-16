import { expect, test } from "bun:test";
import { kiroIdeSteeringText } from "./legacy-includes.ts";

const MEMORY_FILE = "aidlc/spaces/default/memory/org.md";

test("Kiro IDE's steering carries the memory text of the written space", async () => {
  const project = `${Bun.env["TEMP"] ?? "."}/legacy-includes-${crypto.randomUUID()}`;
  await Bun.write(`${project}/${MEMORY_FILE}`, "Organisation layer text\n");
  const steering = kiroIdeSteeringText(project, "default");
  await Bun.file(`${project}/${MEMORY_FILE}`).delete();
  expect(steering).toContain(`<memory-file path="${MEMORY_FILE}">`);
  expect(steering).toContain("Organisation layer text");
});

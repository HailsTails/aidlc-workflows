import { expect, test } from "bun:test";
import { cursorDoctorPrompt } from "./doctor-guidance.ts";

test("copy fills only the explicitly declared doctor position", () => {
  expect(cursorDoctorPrompt({ channel: "copy", content: { kind: "text",
    text: "Before\n{{SLOT:cursor_doctor_guidance}}\nAfter\n" } }))
    .toEqual<readonly string[]>(["Before", "run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),", "After", ""]);
});

test("native declares the original mandatory duty and preserves surrounding CRLF", () => {
  expect(cursorDoctorPrompt({ channel: "native", content: { kind: "text",
    text: "Before\r\n{{SLOT:cursor_doctor_guidance}}\r\nAfter\r\n" } }))
    .toEqual<{ readonly kind: "native-policy"; readonly obligation: string; readonly lines: readonly string[] }>({ kind: "native-policy", obligation: "run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),",
      lines: ["Before\r", "run `aidlc doctor`,\r", "After\r", ""] });
});

test.each([
  { name: "absent", text: "Ordinary prose" },
  { name: "native-looking", text: "run `aidlc doctor`," },
  { name: "legacy", text: "run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found)," },
  { name: "duplicate", text: "{{SLOT:cursor_doctor_guidance}}\n{{SLOT:cursor_doctor_guidance}}" },
  { name: "malformed", text: "{{SLOT:cursor_doctor_guidance}" },
  { name: "stale", text: "{{SLOT:cursor_doctor_guidance_v0}}" },
  { name: "quoted", text: "User quote: {{SLOT:cursor_doctor_guidance}}" },
  { name: "suffixed", text: "{{SLOT:cursor_doctor_guidance}} custom prose" },
])("$name source earns no admission", ({ text }) => {
  expect(cursorDoctorPrompt({ channel: "native", content: { kind: "text", text } })).toBeNull();
});

test("lossless captured UTF-8 bytes retain the explicit native duty", () => {
  expect(cursorDoctorPrompt({ channel: "native", content: { kind: "bytes", bytes: new Uint8Array([123,123,83,76,79,84,58,99,117,114,115,111,114,95,100,111,99,116,111,114,95,103,117,105,100,97,110,99,101,125,125]) } }))
    .toEqual<{ readonly kind: "native-policy"; readonly obligation: string; readonly lines: readonly string[] }>({ kind: "native-policy", obligation: "run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),", lines: ["run `aidlc doctor`,"] });
});

test("opaque non-UTF-8 bytes cannot be normalized into admitted prose", () => {
  expect(cursorDoctorPrompt({ channel: "native", content: { kind: "bytes", bytes: new Uint8Array([255,10,123,123,83,76,79,84,58,99,117,114,115,111,114,95,100,111,99,116,111,114,95,103,117,105,100,97,110,99,101,125,125]) } })).toBeNull();
});

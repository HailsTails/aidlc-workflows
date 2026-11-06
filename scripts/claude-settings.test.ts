import { expect, test } from "bun:test";
import { prepareClaudeSettingsText } from "./claude-settings.ts";

test("expands the first authored glob using explicit ordered capabilities while retaining unrelated JSON", () => {
  expect(prepareClaudeSettingsText({ text: '{"z":1,"permissions":{"deny":["Secret"],"allow":["Read","Bash(bun .authored/tools/aidlc-*)",null,{"custom":true},"Bash(bun .other/tools/aidlc-*)"],"extra":"keep"},"tail":"${CONTEXT7_API_KEY}"}', dispatcherCommands: ["doctor", "config --show", "doctor"], toolScripts: ["aidlc-doc.ts", "aidlc-doc.ts"] })).toEqual({ kind: "prepared", content: "{\n  \"z\": 1,\n  \"permissions\": {\n    \"deny\": [\n      \"Secret\"\n    ],\n    \"allow\": [\n      \"Read\",\n      \"Bash(bun .authored/tools/aidlc.ts doctor)\",\n      \"Bash(bun .authored/tools/aidlc.ts config --show)\",\n      \"Bash(bun .authored/tools/aidlc.ts doctor)\",\n      \"Bash(bun .authored/tools/aidlc-doc.ts)\",\n      \"Bash(bun .authored/tools/aidlc-doc.ts *)\",\n      \"Bash(bun .authored/tools/aidlc-doc.ts)\",\n      \"Bash(bun .authored/tools/aidlc-doc.ts *)\",\n      null,\n      {\n        \"custom\": true\n      },\n      \"Bash(bun .other/tools/aidlc-*)\"\n    ],\n    \"extra\": \"keep\"\n  },\n  \"tail\": \"${CONTEXT7_API_KEY}\"\n}\n" });
});

test("every duplicate equal to the first glob expands while a different matching glob remains authored", () => {
  expect(prepareClaudeSettingsText({ text: '{"permissions":{"allow":["Bash(bun .x/tools/aidlc-*)","Bash(bun .y/tools/aidlc-*)","Bash(bun .x/tools/aidlc-*)"]}}', dispatcherCommands: ["status"], toolScripts: [] })).toEqual({ kind: "prepared", content: "{\n  \"permissions\": {\n    \"allow\": [\n      \"Bash(bun .x/tools/aidlc.ts status)\",\n      \"Bash(bun .y/tools/aidlc-*)\",\n      \"Bash(bun .x/tools/aidlc.ts status)\"\n    ]\n  }\n}\n" });
});

test("empty capability lists remove authored expansion slots without inventing grants", () => {
  expect(prepareClaudeSettingsText({ text: '{"permissions":{"allow":[false,17,"Bash(bun .x/tools/aidlc-*)","WebFetch"]}}', dispatcherCommands: [], toolScripts: [] })).toEqual({ kind: "prepared", content: "{\n  \"permissions\": {\n    \"allow\": [\n      false,\n      17,\n      \"WebFetch\"\n    ]\n  }\n}\n" });
});

test("unrelated prototype-like JSON keys survive admission and serialization", () => {
  expect(prepareClaudeSettingsText({ text: '{"__proto__":{"root":"keep"},"permissions":{"__proto__":"inner","allow":["Bash(bun .x/tools/aidlc-*)"]},"constructor":"keep"}', dispatcherCommands: ["status"], toolScripts: [] })).toEqual({ kind: "prepared", content: "{\n  \"__proto__\": {\n    \"root\": \"keep\"\n  },\n  \"permissions\": {\n    \"__proto__\": \"inner\",\n    \"allow\": [\n      \"Bash(bun .x/tools/aidlc.ts status)\"\n    ]\n  },\n  \"constructor\": \"keep\"\n}\n" });
});

test.each([
  "null", "[]", "{}", '{"permissions":null}', '{"permissions":{"allow":"Bash(bun .x/tools/aidlc-*)"}}',
  '{"permissions":{"allow":["Bash(bun .x/tools/aidlc-*.ts)"]}}',
  '{"permissions":{"allow":["Bash(bun .x/tools/aidlc*)"]}}',
  '{"permissions":{"allow":["Bash(bun .space dir/tools/aidlc-*)"]}}',
  '{"permissions":{"allow":["Bash(bun .x/tools/aidlc-*) extra"]}}',
  '{"permissions":{"allow":[{"value":"Bash(bun .x/tools/aidlc-*)"}]}}',
])("retains the exact no-glob refusal for nonmatching or malformed settings: %s", (text) => {
  expect(prepareClaudeSettingsText({ text, dispatcherCommands: ["status"], toolScripts: [] })).toEqual({ kind: "refused", message: "[claude] settings.json has no Bash(bun <dir>/tools/aidlc-*) entry to expand" });
});

test.each(["", "{", '{"permissions":{},}'])("JSON syntax failure is bounded refusal data: %s", (text) => {
  expect(prepareClaudeSettingsText({ text, dispatcherCommands: [], toolScripts: [] })).toEqual({ kind: "refused", message: "[claude] settings.json must contain valid JSON" });
});

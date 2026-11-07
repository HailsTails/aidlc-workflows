import { expect, test } from "bun:test";
import { prepareVersionModuleText, type VersionModuleTextPreparation } from "./version-module.ts";

const CASES: readonly { name: string; source: string; buildVersion: string; expected: VersionModuleTextPreparation }[] = [
  { name: "explicit release stamp", source: 'export const AIDLC_VERSION = "1.2.3";\n', buildVersion: "1.2.4-preview.20261107.1", expected: { kind: "prepared", content: 'export const AIDLC_VERSION = "1.2.4-preview.20261107.1";\n' } },
  { name: "same value keeps bytes", source: 'export const AIDLC_VERSION = "1.2.3";\n', buildVersion: "1.2.3", expected: { kind: "prepared", content: 'export const AIDLC_VERSION = "1.2.3";\n' } },
  { name: "surrounding module text retained", source: '// header\nexport const AIDLC_VERSION = "old";\nexport const OTHER = "old";\n', buildVersion: "new", expected: { kind: "prepared", content: '// header\nexport const AIDLC_VERSION = "new";\nexport const OTHER = "old";\n' } },
  { name: "empty source refused", source: "", buildVersion: "new", expected: { kind: "refused", message: "aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found 0" } },
  { name: "unrelated assignment cannot be stamped", source: 'export const OTHER_VERSION = "old";\n', buildVersion: "new", expected: { kind: "refused", message: "aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found 0" } },
  { name: "indented assignment not admitted", source: ' export const AIDLC_VERSION = "old";\n', buildVersion: "new", expected: { kind: "refused", message: "aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found 0" } },
  { name: "trailing text not admitted", source: 'export const AIDLC_VERSION = "old"; // note\n', buildVersion: "new", expected: { kind: "refused", message: "aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found 0" } },
  { name: "empty original literal not admitted", source: 'export const AIDLC_VERSION = "";\n', buildVersion: "new", expected: { kind: "refused", message: "aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found 0" } },
  { name: "duplicate assignment refused", source: 'export const AIDLC_VERSION = "one";\nexport const AIDLC_VERSION = "two";\n', buildVersion: "new", expected: { kind: "refused", message: "aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found 2" } },
  { name: "unrelated similar line does not inflate count", source: 'export const OTHER_AIDLC_VERSION = "other";\nexport const AIDLC_VERSION = "old";\n', buildVersion: "new", expected: { kind: "prepared", content: 'export const OTHER_AIDLC_VERSION = "other";\nexport const AIDLC_VERSION = "new";\n' } },
  { name: "caller version policy is not reinterpreted", source: 'export const AIDLC_VERSION = "old";\n', buildVersion: "caller-value", expected: { kind: "prepared", content: 'export const AIDLC_VERSION = "caller-value";\n' } },
  { name: "native dollar replacement semantics retained", source: 'export const AIDLC_VERSION = "old";\n', buildVersion: "$&", expected: { kind: "prepared", content: 'export const AIDLC_VERSION = "export const AIDLC_VERSION = "old";";\n' } },
];

test.each([...CASES])("version module text preparation: $name", ({ source, buildVersion, expected }) => {
  expect(prepareVersionModuleText({ source, buildVersion })).toEqual(expected);
});

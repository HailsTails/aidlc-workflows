import { BINDING_HEADINGS } from "../src/cli/host-table.ts";
import { keepOwnHarnessBindings as keepOwn } from "../src/projection/domain/harness-bindings.ts";

export { BINDING_HEADINGS } from "../src/cli/host-table.ts";

export function keepOwnHarnessBindings(content: string, harness: string, file: string): string {
  const rendered = keepOwn({ content, file, ownHeading: BINDING_HEADINGS[harness],
    expectedHeadings: Object.values(BINDING_HEADINGS) });
  if (!rendered.ok) throw new Error(rendered.refusal);
  return rendered.value;
}

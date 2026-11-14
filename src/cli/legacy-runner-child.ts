import { createNodeFileSystem } from "../kernel/file-system.ts";
import { runChild } from "./adapters/routes/projection/legacy-runner-child.ts";

import { duplicateNativeCommand, selectedScopeDescription, selectLegacyDocuments }
  from "../projection/application/legacy-command-plan.ts";

if (import.meta.main) {
  const output = createNodeFileSystem();
  try {
    const reply = await runChild({ raw: await Bun.stdin.json(), output, plan: { duplicateNativeCommand, selectedScopeDescription, selectLegacyDocuments }, load: (module) => import(module.href) });
    console.log(JSON.stringify(reply));
  } catch (error) {
    console.log(JSON.stringify({ entries: [], failure: error instanceof Error ? error.message : String(error) }));
  }
}

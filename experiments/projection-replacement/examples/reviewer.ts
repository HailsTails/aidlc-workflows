import { reviewerRequest } from "../__tests__/fixtures.ts";
import { prepareAndProject } from "../src/application/prepare.ts";
import { claudeTarget } from "../src/adapters/claude.ts";
import { integrate } from "../src/domain/integration.ts";
import { planInstallation } from "../src/domain/installation.ts";
import { createMemoryWriter } from "../src/infrastructure/memory-writer.ts";
const run = () => {
  const request = reviewerRequest();
  const projected = prepareAndProject({ input: request });
  if (projected.status === "invalid") return projected;
  const document = projected.value[0];
  if (document === undefined) return { status: "empty" };
  const native = integrate({
    document: document,
    target: claudeTarget({
      harness: request.contract.harness,
      directory: request.contract.harnessDir,
    }),
  });
  if (native.status === "invalid") return native;
  const writer = createMemoryWriter();
  const installation = planInstallation({
    harness: request.contract.harness,
    selectedPlugins: request.selectedPlugins,
    bundles: [native.value],
    snapshot: writer.snapshot(),
    policy: "reconcile",
  });
  if (installation.status === "invalid") return installation;
  const applied = writer.apply(installation.value);
  const disable = planInstallation({
    harness: request.contract.harness,
    selectedPlugins: [],
    bundles: [],
    snapshot: writer.snapshot(),
    policy: "reconcile",
  });
  return {
    projected: document,
    native: native.value.resources,
    installation: {
      selectedPlugins: installation.value.selectedPlugins,
      changes: installation.value.changes,
      conflicts: installation.value.conflicts,
    },
    applied,
    disable:
      disable.status === "invalid"
        ? disable
        : { changes: disable.value.changes, conflicts: disable.value.conflicts },
  };
};
console.log(JSON.stringify(run(), null, 2));

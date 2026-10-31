import { resolveConstitutionEngine } from "./rin-harness-config.ts";
import { projectDirOf } from "./rin-harness-engine-bound-cd-sensor.ts";
import { defaultReviewProcessPort } from "./rin-gates/review-process-port.ts";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";

const DISCIPLINE_CORE_DECAY_WIRE = {
  pass: true,
  findings_count: 0,
  findings: [],
  scanned: "(constitution.engine is discipline-core: core reports forfeited carve-outs, and the disciplines sensor applies)",
};

const processPort = defaultReviewProcessPort();
const pathOperations = defaultPathOperations();

const resolution = resolveConstitutionEngine({
  projectDir: projectDirOf({ argumentList: processPort.arguments, environment: processPort.environment }),
});

if (resolution.outcome === "resolved" && resolution.constitutionEngine.engine === "discipline-core") {
  processPort.publish(`${JSON.stringify(DISCIPLINE_CORE_DECAY_WIRE)}\n`);
  processPort.exit(0);
}

const decayToolPath = pathOperations.join({
  segments: [
    pathOperations.dirname({ path: pathOperations.fromFileUrl({ url: import.meta.url }) }),
    "rin-harness-carve-out-decay.ts",
  ],
});
const decayOutput = processPort.runSync({
  program: "bun",
  args: [decayToolPath, ...processPort.arguments.slice(2)],
  environment: processPort.environment,
});
processPort.publish(decayOutput.stdout);
processPort.diagnose(decayOutput.stderr);
processPort.exit(decayOutput.status ?? 1);

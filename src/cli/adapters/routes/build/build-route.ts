import type { HostIdentity } from "../../../../kernel/host.ts";
import type { Terminal } from "../../../../kernel/terminal-port.ts";
import type { Result } from "../../../../kernel/result.ts";
import type { PackagingRefusal } from "../../../../packaging/domain/artifact.ts";
import type { Payload } from "../../../../packaging/domain/payload.ts";
import type { CommandRoute, ExitStatus } from "../../../roots.ts";
import type { BuildMode, ModelCapReading } from "../../../../projection/domain/model-cap.ts";
import type { MethodRefusal } from "../../../../workflow-definition/domain/refusals.ts";
import type { KernelRefusal } from "../../../../kernel/values.ts";
import type { ProjectionRefusal } from "../../../../projection/domain/projection.ts";

class PreparationDiagnostic extends Error {
  readonly lines: readonly string[];
  readonly refusals: readonly (MethodRefusal | KernelRefusal | ProjectionRefusal)[];
  constructor(request: {
    readonly lines: readonly string[];
    readonly refusals: readonly (MethodRefusal | KernelRefusal | ProjectionRefusal)[];
  }) {
    super(request.lines.join("\n"));
    this.lines = request.lines;
    this.refusals = request.refusals;
  }
}

export const methodPreparationDiagnostic = (request: {
  readonly method: "core" | "plugin"; readonly refusals: readonly MethodRefusal[];
}): Error => new PreparationDiagnostic({ refusals: request.refusals,
  lines: [`Cannot load the ${request.method === "core" ? "fresh" : "plugin"} Method: ${JSON.stringify(request.refusals)}`] });

export const entrypointPreparationDiagnostic = (refusals: readonly (KernelRefusal | ProjectionRefusal)[]): Error =>
  new PreparationDiagnostic({ refusals, lines: refusals.map((refusal) => JSON.stringify(refusal)) });

type BuildRouteFailure = KernelRefusal | ProjectionRefusal | PackagingRefusal;

type RouteDistributionBuilds = {
  build(request: {
    readonly hosts: readonly HostIdentity[];
    readonly refusals: readonly PackagingRefusal[];
    readonly sweep: "full" | "named";
  }): Promise<Result<{ readonly record: "recorded" | "inputs-changed" }, readonly BuildRouteFailure[]>>;
  check(request: {
    readonly hosts: readonly HostIdentity[];
    readonly refusals: readonly PackagingRefusal[];
  }): Promise<Result<{
    readonly problems: readonly string[];
    readonly inputs: "unchanged" | "inputs-changed";
  }, readonly BuildRouteFailure[]>>;
};

type BuildRoutePorts = {
  readonly hosts: readonly HostIdentity[];
  readonly refusals: readonly PackagingRefusal[];
  readonly distributions: (mode: BuildMode) => RouteDistributionBuilds;
  readonly terminal: Terminal;
};

const failed = (request: {
  readonly terminal: Terminal; readonly failures: readonly BuildRouteFailure[] }):
  ExitStatus => {
  if (request.failures.some((failure) => failure.kind === "host-build-refused")) {
    for (const failure of request.failures) request.terminal.writeError(`${JSON.stringify(failure)}\n`);
    request.terminal.writeError(
      "A host in the host table cannot be built. Fix the member each line names in src/cli/host-table.ts.\n");
    return 1;
  }
  const first = request.failures[0];
  request.terminal.writeError(first?.kind === "shared-root-integration-differs"
    ? `shared identical root integration ${first.path} differs between ` +
      `${first.distributions[0]} and ${first.distributions[1]}\n`
    : `${JSON.stringify(request.failures)}\n`);
  return 1;
};

export const announceBuiltPayload = (request: { readonly terminal: Terminal; readonly hostPayload: Payload }): void => {
  const { host } = request.hostPayload.descriptor;
  const folder = request.hostPayload.channel === "copy" ? "dist" : "dist-release";
  request.terminal.write(`[${host.distribution}] regenerated ${folder}/${host.distribution}/${host.directory}\n`);
};

const checked = async (request: BuildRoutePorts & {
  readonly targets: readonly HostIdentity[];
  readonly operation: RouteDistributionBuilds;
}): Promise<ExitStatus> => {
  const checkedBuild = await request.operation.check({ hosts: request.targets, refusals: request.refusals });
  if (!checkedBuild.ok) return failed({ terminal: request.terminal, failures: checkedBuild.refusal });
  if (checkedBuild.value.problems.length > 0) {
    request.terminal.writeError(`\npackage --check FAILED (${checkedBuild.value.problems.length} problem(s)):\n`);
    for (const problem of checkedBuild.value.problems.slice(0, 40)) request.terminal.writeError(`  ${problem}\n`);
    return 1;
  }
  if (checkedBuild.value.inputs === "inputs-changed") {
    request.terminal.writeError("A packaging input changed during the determinism check; run it again.\n");
    return 1;
  }
  request.terminal.write("package --check: deterministic across two independent build(s) " +
    `for ${request.targets.map((host) => host.distribution).join(", ")}.\n`);
  return 0;
};

const buildTargets = (ports: BuildRoutePorts, argv: readonly string[]) => {
  const named = argv.find((word) => !word.startsWith("--"));
  const available = [...ports.hosts].sort((first, second) => first.distribution < second.distribution
    ? -1 : Number(first.distribution > second.distribution));
  const hosts = named === undefined ? available : available.filter((host) => host.distribution === named);
  if (named !== undefined && hosts.length === 0 && ports.refusals.length === 0) {
    ports.terminal.writeError(`unknown harness "${named}" (have: ${available
      .map((host) => host.distribution).join(", ") || "none"})\n`);
    return null;
  }
  return { hosts, sweep: named === undefined ? "full" as const : "named" as const };
};

const executeBuild = async (ports: BuildRoutePorts, argv: readonly string[]): Promise<ExitStatus> => {
  const mode = argv.includes("--check") ? "check" : "build";
  const operation = ports.distributions(mode);
  const targets = buildTargets(ports, argv);
  if (!targets) return 1;
  if (mode === "check") return checked({ ...ports, targets: targets.hosts, operation });
  const built = await operation.build({ ...targets, refusals: ports.refusals });
      if (!built.ok) return failed({ terminal: ports.terminal, failures: built.refusal });
      if (built.value.record === "inputs-changed") {
        ports.terminal.writeError("[sources] a packaging input changed while packaging, so the generated trees may mix " +
          "old and new files: run `bun scripts/package.ts` again.\n");
        return 1;
      }
  return 0;
};

export const createBuildRoute = (ports: BuildRoutePorts): CommandRoute => ({
  verb: [],
  run: async (argv) => {
    try {
      return await executeBuild(ports, argv);
    } catch (error) {
      if (!(error instanceof PreparationDiagnostic)) throw error;
      for (const line of error.lines) ports.terminal.writeError(`${line}\n`);
      return 1;
    }
  },
});

export const announceModelCap = (request: { readonly terminal: Terminal; readonly reading: ModelCapReading }): void => {
  const { reading, terminal } = request;
  if (reading.cap) terminal.writeError(`[tier] pack-time tier cap active: ${reading.cap} ` +
    `(source: ${reading.source === "environment" ? "AIDLC_TIER_CAP env var" : "core/memory tier_cap:"})\n`);
  else if (reading.environment === "ignored") terminal.writeError(
    "[tier] AIDLC_TIER_CAP is set but IGNORED under --check " +
    "(the env cap is a one-shot write knob; persistent caps live in core/memory)\n");
};

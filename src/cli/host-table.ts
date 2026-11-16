import { claudeHost } from "../hosts/claude/host.ts";
import { codexHost } from "../hosts/codex/host.ts";
import { copilotHost } from "../hosts/copilot/host.ts";
import { cursorHost } from "../hosts/cursor/host.ts";
import { kiroIdeHost } from "../hosts/kiro-ide/host.ts";
import { kiroHost, kiroPersonas } from "../hosts/kiro/host.ts";
import { openCodeHost } from "../hosts/opencode/host.ts";
import type { HostIdentity } from "../kernel/host.ts";
import type { PackagingRefusal } from "../packaging/domain/artifact.ts";
import type { HostBuildTable, HostModule } from "./roots.ts";

const BUILT = [
  claudeHost(), kiroHost(), kiroIdeHost(kiroPersonas), codexHost(), cursorHost(), openCodeHost(),
  copilotHost(),
];

export const HOSTS: HostBuildTable = BUILT.flatMap((built) => built.ok ? [built.value] : []);

export const HOST_BUILD_REFUSALS: readonly PackagingRefusal[] = BUILT.flatMap((built) =>
  built.ok ? [] : [{ kind: "host-build-refused" as const, reason: built.refusal }]);

export const hostModule = (host: HostIdentity): HostModule | undefined =>
  HOSTS.find((candidate) => candidate.host.distribution === host.distribution);

export const BINDING_HEADINGS: Readonly<Record<string, string>> = Object.fromEntries(
  HOSTS.map((module) => [module.host.distribution, module.projection.bindingHeading]),
);

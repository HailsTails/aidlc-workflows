import type { HostIdentity } from "../../kernel/host.ts";
import type { FrameworkVersion } from "../../kernel/values.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { ArchiveFile, PackagingRefusal } from "../domain/artifact.ts";
import type { Payload } from "../domain/payload.ts";
import type { ReleaseArchives } from "../domain/release-archives.ts";
import type { BuildPackaging, DistributionPayloads, DistributionBuildFailure } from "./ports.ts";
import type { BuildReleaseArtifact } from "./use-cases.ts";

type ReleasePreparation = {
  readonly payloadsFor: (host: HostIdentity) =>
    Promise<Result<DistributionPayloads, readonly DistributionBuildFailure[]>>;
};

type ReleasePairs = { readonly copies: readonly Payload[]; readonly natives: readonly Payload[] };

const releasePayloads = (ports: { readonly hosts: readonly HostIdentity[];
  readonly preparation: ReleasePreparation; readonly root: URL }) => {
  const empty: ReleasePairs = { copies: [], natives: [] };
  return [...ports.hosts].sort((left, right) => left.distribution.localeCompare(right.distribution))
    .reduce<Promise<Result<ReleasePairs, readonly DistributionBuildFailure[]>>>(async (pending, host) => {
      const previous = await pending;
      if (!previous.ok) return previous;
      const payloads = await ports.preparation.payloadsFor(host);
      if (!payloads.ok) return payloads;
      const copy = await payloads.value({ host, channel: "copy", copy: null,
        projectRoot: new URL(`dist/${host.distribution}`, ports.root) });
      if (!copy.ok) return copy;
      const native = await payloads.value({ host, channel: "native", copy: copy.value,
        projectRoot: new URL(`dist-release/${host.distribution}`, ports.root) });
      return native.ok ? accepted({ copies: [...previous.value.copies, copy.value],
        natives: [...previous.value.natives, native.value] }) : native;
    }, Promise.resolve(accepted(empty)));
};

export const createBuildReleaseArchives = <PreparationFailure>(ports: {
  readonly version: BuildPackaging["version"];
  readonly root: URL;
  readonly hosts: readonly HostIdentity[];
  readonly prepare: () => Promise<Result<ReleasePreparation, readonly PreparationFailure[]>>;
  readonly artifacts: () => {
    readonly build: BuildReleaseArtifact["build"];
    readonly readPlugins: (root: URL) => Promise<Result<readonly ArchiveFile[], readonly PackagingRefusal[]>>;
  };
}) => async (release: {
  readonly pluginTrees: URL; readonly names: { readonly runtime: string; readonly copyRuntime: string };
  readonly stampedAs: FrameworkVersion;
}): Promise<Result<ReleaseArchives, readonly (DistributionBuildFailure | PreparationFailure)[]>> => {
  if (!ports.version.ok) return refused([ports.version.refusal]);
  if (ports.version.value !== release.stampedAs) return refused([{
    kind: "mixed-versions", versions: [ports.version.value, release.stampedAs],
  }]);
  const prepared = await ports.prepare();
  if (!prepared.ok) return prepared;
  const pairs = await releasePayloads({ hosts: ports.hosts, preparation: prepared.value, root: ports.root });
  if (!pairs.ok) return pairs;
  const artifacts = ports.artifacts();
  const additions = await artifacts.readPlugins(release.pluginTrees);
  if (!additions.ok) return additions;
  const runtime = await artifacts.build({ name: release.names.runtime, format: "tar.gz", payloads: pairs.value.natives,
    additions: additions.value });
  if (!runtime.ok) return runtime;
  const copyRuntime = await artifacts.build({ name: release.names.copyRuntime, format: "tar.gz", payloads: pairs.value.copies,
    additions: additions.value });
  return copyRuntime.ok ? accepted({ runtime: runtime.value, copyRuntime: copyRuntime.value }) : copyRuntime;
};

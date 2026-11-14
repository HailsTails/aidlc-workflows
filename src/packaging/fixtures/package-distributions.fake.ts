import { mock } from "bun:test";
import { accepted, type Result } from "../../kernel/result.ts";
import { hash, path, version } from "../../kernel/fixtures/values.fixture.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import type { Payload } from "../domain/payload.ts";
import type { DistributionBuildFailure, DistributionPayloads, DistributionPlugins, OutputTrees, PackagedSources } from "../application/ports.ts";
import { createPackageDistributions } from "../application/package-distributions.ts";

const hostPayload = ({ identity, channel, sharedText }: {
  readonly identity: HostIdentity; readonly channel: "copy" | "native"; readonly sharedText: string | undefined;
}): Payload => ({
  version: version("2.12.0"), channel,
  descriptor: { host: identity, layout: { managedDirectories: [], rootIntegrations: sharedText === undefined ? [] : [{
    path: path("AGENTS.md"), policy: "whole-file", presence: "required", sharing: "identical",
  }] }, history: { retiredFiles: [], priorIntegrations: [] } },
  files: sharedText === undefined ? [] : [{ path: path("AGENTS.md"), content: { kind: "text", text: sharedText },
    hash: hash("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
    mode: "regular", origin: { kind: "distribution-descriptor" } }],
});

export const createDistributionBuildFixture = (options: {
  readonly preparation?: Result<void, readonly DistributionBuildFailure[]>;
  readonly shared?: Readonly<Record<string, string>>;
} = {}) => {
  const events: string[] = [];
  const produced: Payload[] = [];
  const fingerprint = mock<PackagedSources["fingerprint"]>(async () => {
    events.push("fingerprint"); return accepted("before");
  });
  const forget = mock<PackagedSources["forget"]>(async () => { events.push("forget"); return accepted(undefined); });
  const record = mock<PackagedSources["record"]>(async () => { events.push("record"); return accepted("recorded"); });
  const sources: PackagedSources = { fingerprint, forget, record, staleness: async () => accepted(null) };
  const payloads = mock<DistributionPayloads>(async ({ host: identity, channel }) => {
    events.push(`payload:${identity.distribution}:${channel}`);
    const built = hostPayload({ identity, channel, sharedText: options.shared?.[identity.distribution] });
    produced.push(built);
    return accepted(built);
  });
  const list = mock<OutputTrees["list"]>(async (folder) => {
    events.push(`list:${folder.href}`); return accepted(["stale.txt", "claude", "plugins"]);
  });
  const remove = mock<OutputTrees["remove"]>(async (entry) => {
    events.push(`remove:${entry.href}`); return accepted(entry);
  });
  const writePayload = mock<OutputTrees["writePayload"]>(async ({ root, payload: written }) => {
    events.push(`write:${written.descriptor.host.distribution}:${written.channel}`); return accepted(root);
  });
  const scratchRoots = [new URL("file:///scratch/first/"), new URL("file:///scratch/second/")];
  const scratch = mock<OutputTrees["scratch"]>(async () =>
    accepted(scratchRoots.shift() ?? new URL("file:///scratch/second/")));
  const read = mock<OutputTrees["read"]>(async () => accepted([]));
  const outputs: OutputTrees = { root: new URL("file:///repo/"), list, remove, writePayload, scratch, read };
  const buildPlugins = mock<DistributionPlugins["build"]>(() => {
    events.push("plugins"); return accepted(undefined);
  });
  const plugins: DistributionPlugins = { directories: ["test-pro"], build: buildPlugins };
  const prepare = mock<Parameters<typeof createPackageDistributions>[0]["prepare"]>(async () => {
    events.push("prepare"); return options.preparation ?? accepted(undefined);
  });
  return { operation: createPackageDistributions({ payloads, plugins, outputs, sources, prepare }), prepare,
    events, produced, payloads, list, remove, writePayload, scratch, read, buildPlugins, fingerprint, forget, record };
};

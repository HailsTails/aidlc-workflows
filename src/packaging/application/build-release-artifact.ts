import { brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { ArchiveEntry, ArchiveFile, PackagingRefusal } from "../domain/artifact.ts";
import type { Payload } from "../domain/payload.ts";
import type { ArtifactWriter, CopyRuntimeOmissions } from "./ports.ts";
import type { BuildReleaseArtifact } from "./use-cases.ts";

const payloadHead = (payloads: readonly Payload[]): Result<Payload, PackagingRefusal> => {
  const first = payloads[0];
  if (!first) return refused({ kind: "no-payloads" });
  const otherVersion = payloads.find((candidate) => candidate.version !== first.version);
  if (otherVersion) return refused({ kind: "mixed-versions", versions: [first.version, otherVersion.version] });
  const otherChannel = payloads.find((candidate) => candidate.channel !== first.channel);
  if (otherChannel) return refused({ kind: "mixed-channels", channels: [first.channel, otherChannel.channel] });
  const duplicate = payloads.find((candidate, index) => payloads.findIndex((other) =>
    other.descriptor.host.distribution === candidate.descriptor.host.distribution && other.channel === candidate.channel) !== index);
  return duplicate ? refused({ kind: "duplicate-payload", distribution: duplicate.descriptor.host.distribution,
    channel: duplicate.channel }) : accepted(first);
};

const archiveFiles = (releasePayload: Payload, omissions: CopyRuntimeOmissions): readonly ArchiveFile[] => {
  const omitted = releasePayload.channel === "copy" ? omissions.omitted(releasePayload) : [];
  return releasePayload.files.filter((file) => !omitted.includes(file.path)).map((file) => ({
    entry: brand<ArchiveEntry>(`runtime/${releasePayload.descriptor.host.distribution}/${file.path}`),
    content: file.content, mode: file.mode,
  }));
};

export const createBuildReleaseArtifact = (ports: {
  readonly writer: ArtifactWriter;
  readonly omissions: CopyRuntimeOmissions;
}): BuildReleaseArtifact => ({ build: async (request) => {
  const first = payloadHead(request.payloads);
  if (!first.ok) return refused([first.refusal]);
  const files = [...request.payloads.flatMap((releasePayload) => archiveFiles(releasePayload, ports.omissions)), ...request.additions];
  const written = await ports.writer.write({ name: request.name, format: request.format, files });
  return written.ok ? accepted({ name: request.name, format: request.format, version: first.value.version,
    channel: first.value.channel, distributions: request.payloads.map((releasePayload) => releasePayload.descriptor.host.distribution),
    digest: written.value, entries: files.map((file) => file.entry) }) : refused([written.refusal]);
} });

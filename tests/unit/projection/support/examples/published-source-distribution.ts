import { assemblePersistedSourceDistribution } from "./persisted-source-distribution.ts";
import type { PublicationRepository, PublicationSnapshot } from "../src/domain/projection-publication.ts";
import { finding, type Outcome } from "../../../../../scripts/projection/src/domain/model.ts";
export type PublishedSourceRequest = Omit<Parameters<typeof assemblePersistedSourceDistribution>[0], "ownershipJson" | "services"> & { readonly expectedHead: string | null; readonly initialOwnershipJson: string; readonly repository: PublicationRepository; readonly assemble?: typeof assemblePersistedSourceDistribution };
export const producePublishedSourceDistribution = async ({ repository, assemble = assemblePersistedSourceDistribution, expectedHead, initialOwnershipJson, ...request }: PublishedSourceRequest): Promise<Outcome<PublicationSnapshot>> => {
  const snapshot = await repository.read();
  if (snapshot.status === "invalid") return snapshot;
  if (snapshot.value.head !== expectedHead) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "projection-publication", detail: "publication head changed; reload its artifact and ownership together before producing again" })] };
  const assembled = await assemble({ ...request, ownershipJson: snapshot.value.publication?.ownershipJson ?? initialOwnershipJson });
  return assembled.status === "invalid" ? assembled : repository.publish({ expectedHead, artifactPair: { archive: assembled.value.archive, ownershipJson: assembled.value.ownershipJson } });
};

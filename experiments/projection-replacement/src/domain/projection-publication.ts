import { finding, type Outcome } from "./model.ts";
export type ProjectionPublicationPayload = { readonly archive: Uint8Array; readonly ownershipJson: string };
export type ProjectionPublication = ProjectionPublicationPayload & { readonly revision: number; readonly previous: string | null; readonly token: string };
export type PublicationSnapshot = { readonly head: string | null; readonly publication: ProjectionPublication | null };
export type PublicationRules = { readonly digest: (input: { readonly bytes: Uint8Array }) => string; readonly encode: (input: { readonly text: string }) => Uint8Array };
const publicationToken = ({ publication, rules }: { readonly publication: Omit<ProjectionPublication, "token">; readonly rules: PublicationRules }): string => rules.digest({ bytes: rules.encode({ text: JSON.stringify([publication.revision, publication.previous, rules.digest({ bytes: publication.archive }), rules.digest({ bytes: rules.encode({ text: publication.ownershipJson }) })]) }) });
export const inspectPublicationHistory = ({ publications, rules }: { readonly publications: readonly ProjectionPublication[]; readonly rules: PublicationRules }): Outcome<PublicationSnapshot> => {
  const changed = publications.filter((publication, index) => publication.revision !== index + 1 || publication.previous !== (publications[index - 1]?.token ?? null) || publication.token !== publicationToken({ publication, rules }));
  if (changed.length > 0) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "projection-publication", detail: "published bytes or history changed; preserve the store and resolve its ownership before publishing" })] };
  const publication = publications.at(-1) ?? null;
  return { status: "ok", value: { head: publication?.token ?? null, publication } };
};
export const preparePublication = ({ snapshot, expectedHead, artifactPair, rules }: { readonly snapshot: PublicationSnapshot; readonly expectedHead: string | null; readonly artifactPair: ProjectionPublicationPayload; readonly rules: PublicationRules }): Outcome<ProjectionPublication> => {
  if (snapshot.head !== expectedHead) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "projection-publication", detail: "publication head changed; reload its artifact and ownership together before producing again" })] };
  if (artifactPair.archive.length === 0 || artifactPair.ownershipJson.length === 0) return { status: "invalid", findings: [finding({ code: "empty-integration", subject: "projection-publication", detail: "publication requires both native archive bytes and ownership JSON" })] };
  const publication = { ...artifactPair, revision: (snapshot.publication?.revision ?? 0) + 1, previous: snapshot.head };
  return { status: "ok", value: { ...publication, token: publicationToken({ publication, rules }) } };
};
export type PublicationRepository = { readonly read: () => Promise<Outcome<PublicationSnapshot>>; readonly publish: (input: { readonly expectedHead: string | null; readonly artifactPair: ProjectionPublicationPayload }) => Promise<Outcome<PublicationSnapshot>> };

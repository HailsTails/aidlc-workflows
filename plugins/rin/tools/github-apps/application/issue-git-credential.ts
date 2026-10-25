import { matchRepositoryPath, type RepositorySlug } from "../domain/repository-slug.ts";
import { fail, type Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import type { TokenFailure } from "./mint-installation-token.ts";

type GitCredentialQuery = {
  readonly protocol: string;
  readonly host: string;
  readonly path: string | undefined;
};

type CredentialDestinationRefused = {
  readonly kind: "credential-destination-refused";
  readonly destination: string;
};

type MintAuthorToken = () => Promise<Result<Secret, TokenFailure>>;

type GitCredentialIssuance = {
  readonly query: GitCredentialQuery;
  readonly repository: RepositorySlug;
  readonly mintAuthorToken: MintAuthorToken;
};

type CredentialDestination = "configured-repository" | "elsewhere";

const classifyDestination = ({
  query,
  repository,
}: Pick<GitCredentialIssuance, "query" | "repository">): CredentialDestination =>
  query.protocol === "https" &&
  query.host === "github.com" &&
  query.path !== undefined &&
  matchRepositoryPath({ repository, requestedPath: query.path }) === "same-repository"
    ? "configured-repository"
    : "elsewhere";

const issueGitCredential = async (
  issuance: GitCredentialIssuance,
): Promise<Result<Secret, TokenFailure | CredentialDestinationRefused>> => {
  const { query, mintAuthorToken } = issuance;
  if (classifyDestination(issuance) === "elsewhere") {
    return fail({
      kind: "credential-destination-refused",
      destination: `${query.protocol}://${query.host}/${query.path ?? ""}`,
    });
  }
  return mintAuthorToken();
};

export {
  issueGitCredential,
  type CredentialDestinationRefused,
  type GitCredentialIssuance,
  type GitCredentialQuery,
  type MintAuthorToken,
};

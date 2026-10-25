type RepositorySlug = { readonly owner: string; readonly name: string };

type RepositoryPathMatch = "same-repository" | "other-repository";

type RepositoryPathComparison = {
  readonly repository: RepositorySlug;
  readonly requestedPath: string;
};

type RemoteUrlComparison = {
  readonly repository: RepositorySlug;
  readonly remoteUrl: string;
};

const GITHUB_REMOTE_URL =
  /^(?:https:\/\/(?:[^@/]+@)?github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([^/?#]+\/[^/?#]+?)\/?$/i;

const formatRepositorySlug = ({ owner, name }: RepositorySlug): string => `${owner}/${name}`;

const matchRepositoryPath = ({
  repository,
  requestedPath,
}: RepositoryPathComparison): RepositoryPathMatch =>
  requestedPath.replace(/\.git$/, "").toLowerCase() ===
  formatRepositorySlug(repository).toLowerCase()
    ? "same-repository"
    : "other-repository";

const matchRemoteUrl = ({ repository, remoteUrl }: RemoteUrlComparison): RepositoryPathMatch => {
  const [, requestedPath] = GITHUB_REMOTE_URL.exec(remoteUrl.trim()) ?? [];
  if (requestedPath === undefined) return "other-repository";
  return matchRepositoryPath({ repository, requestedPath });
};

export {
  formatRepositorySlug,
  matchRemoteUrl,
  matchRepositoryPath,
  type RepositoryPathMatch,
  type RepositorySlug,
};

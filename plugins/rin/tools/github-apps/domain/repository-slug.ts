type RepositorySlug = { readonly owner: string; readonly name: string };

type RepositoryPathMatch = "same-repository" | "other-repository";

type RemoteUrlMatch = RepositoryPathMatch | "not-github-https";

type RepositoryPathComparison = {
  readonly repository: RepositorySlug;
  readonly requestedPath: string;
};

type RemoteUrlComparison = {
  readonly repository: RepositorySlug;
  readonly remoteUrl: string;
};

const GITHUB_HTTPS_REMOTE_URL = /^https:\/\/github\.com\/([^/?#]+\/[^/?#]+?)\/?$/i;

const formatRepositorySlug = ({ owner, name }: RepositorySlug): string => `${owner}/${name}`;

const matchRepositoryPath = ({
  repository,
  requestedPath,
}: RepositoryPathComparison): RepositoryPathMatch =>
  requestedPath.replace(/\.git$/, "").toLowerCase() ===
  formatRepositorySlug(repository).toLowerCase()
    ? "same-repository"
    : "other-repository";

const matchRemoteUrl = ({ repository, remoteUrl }: RemoteUrlComparison): RemoteUrlMatch => {
  const [, requestedPath] = GITHUB_HTTPS_REMOTE_URL.exec(remoteUrl.trim()) ?? [];
  if (requestedPath === undefined) return "not-github-https";
  return matchRepositoryPath({ repository, requestedPath });
};

export {
  formatRepositorySlug,
  matchRemoteUrl,
  matchRepositoryPath,
  type RemoteUrlMatch,
  type RepositoryPathMatch,
  type RepositorySlug,
};

type RepositorySlug = { readonly owner: string; readonly name: string };

type RepositoryPathMatch = "same-repository" | "other-repository";

type RepositoryPathComparison = {
  readonly repository: RepositorySlug;
  readonly requestedPath: string;
};

const formatRepositorySlug = ({ owner, name }: RepositorySlug): string => `${owner}/${name}`;

const matchRepositoryPath = ({
  repository,
  requestedPath,
}: RepositoryPathComparison): RepositoryPathMatch =>
  requestedPath.replace(/\.git$/, "").toLowerCase() ===
  formatRepositorySlug(repository).toLowerCase()
    ? "same-repository"
    : "other-repository";

export { formatRepositorySlug, matchRepositoryPath, type RepositoryPathMatch, type RepositorySlug };

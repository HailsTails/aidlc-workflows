const PRIVATE_KEY_ARMOUR = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/;

const GITHUB_TOKEN = /gh[oprsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/;

type Publishability = "publishable" | "contains-private-key" | "contains-github-token";

type DirectoryContainment = { readonly path: string; readonly directory: string };

const comparablePath = (path: string): string =>
  path.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();

const assessPublishability = (text: string): Publishability => {
  if (PRIVATE_KEY_ARMOUR.test(text)) return "contains-private-key";
  if (GITHUB_TOKEN.test(text)) return "contains-github-token";
  return "publishable";
};

const isInsideDirectory = ({ path, directory }: DirectoryContainment): boolean => {
  const comparableDirectory = comparablePath(directory);
  const comparableTarget = comparablePath(path);
  return (
    comparableTarget === comparableDirectory ||
    comparableTarget.startsWith(`${comparableDirectory}/`)
  );
};

export { assessPublishability, isInsideDirectory, type Publishability };

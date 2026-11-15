const PRIVATE_KEY_ARMOUR = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/;

const USER_TOKEN = /gh[ur]_[A-Za-z0-9]{20,}/;

type Publishability = "publishable" | "contains-private-key" | "contains-user-token";

type DirectoryContainment = { readonly path: string; readonly directory: string };

const comparablePath = (path: string): string =>
  path.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();

const assessPublishability = (text: string): Publishability => {
  if (PRIVATE_KEY_ARMOUR.test(text)) return "contains-private-key";
  if (USER_TOKEN.test(text)) return "contains-user-token";
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

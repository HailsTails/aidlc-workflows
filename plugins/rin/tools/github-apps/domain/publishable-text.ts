const PRIVATE_KEY_ARMOUR = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/;

type DirectoryContainment = { readonly path: string; readonly directory: string };

const comparablePath = (path: string): string =>
  path.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();

const containsPrivateKey = (text: string): boolean => PRIVATE_KEY_ARMOUR.test(text);

const isInsideDirectory = ({ path, directory }: DirectoryContainment): boolean => {
  const comparableDirectory = comparablePath(directory);
  const comparableTarget = comparablePath(path);
  return (
    comparableTarget === comparableDirectory ||
    comparableTarget.startsWith(`${comparableDirectory}/`)
  );
};

export { containsPrivateKey, isInsideDirectory };

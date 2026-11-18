export type PathMatcher = (path: string) => boolean;

const REGEX_SPECIAL = /[.+^$()|[\]\\]/g;

const GLOB_TOKENS: Readonly<Record<string, string>> = {
  "**/": "(?:.*/)?",
  "/**": "(?:/.*)?",
  "**": ".*",
  "*": "[^/]*",
  "?": "[^/]",
};

const expandBraces = (glob: string): readonly string[] => {
  const group = /\{([^{}]*)\}/.exec(glob);
  if (group === null) {
    return [glob];
  }
  const [whole, body = ""] = group;
  return body.split(",").flatMap((option) => expandBraces(glob.replace(whole, option)));
};

const translate = (glob: string): string =>
  glob
    .replace(REGEX_SPECIAL, "\\$&")
    .replace(/\*\*\/|\/\*\*$|\*\*|\*|\?/g, (token) => GLOB_TOKENS[token] ?? token);

export const globMatcher = (globs: readonly string[]): PathMatcher => {
  const patterns = globs.flatMap(expandBraces).map((glob) => new RegExp(`^${translate(glob)}$`));
  return (path) => patterns.some((pattern) => pattern.test(path));
};

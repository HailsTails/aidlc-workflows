const literal = (module: string): string => module.replaceAll(".", "\\.").replaceAll("-", "\\-");

export const importsAnyOf = (request: {
  readonly text: string;
  readonly modules: readonly string[];
}): boolean =>
  request.modules.some((module) =>
    new RegExp(`from\\s+["'][^"']*${literal(module)}(?:\\.ts)?["']`).test(request.text),
  );

export const filterPattern = (files: readonly string[]): string => {
  const names = files.map((file) => (file.split("/").pop() ?? file).replace(/(\.test)?\.ts$/, ""));
  return `^(${names.join("|")})`;
};

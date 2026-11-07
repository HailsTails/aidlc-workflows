import { isBuiltin } from "node:module";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { SourceContentDigest } from "../domain/source-origin.ts";

export function ordinaryCopilotPath(path: string, directory: boolean): void {
  if (!isAbsolute(path)) throw new Error("Copilot source preparation requires explicit absolute paths");
  const absolute = resolve(path), actual = realpathSync(absolute), stat = lstatSync(absolute);
  if ((process.platform === "win32" ? actual.toLowerCase() !== absolute.toLowerCase() : actual !== absolute) || stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) throw new Error("Copilot source preparation requires ordinary paths");
}

export function observeCopilotSettingsInputs(sourceRoot: string): readonly SourceContentDigest[] {
  ordinaryCopilotPath(sourceRoot, true);
  const paths = new Set<string>();
  const scanner = new Bun.Transpiler({ loader: "ts" });
  const visit = (path: string): void => {
    if (paths.has(path)) return;
    const absolute = resolve(sourceRoot, path);
    if (!absolute.startsWith(resolve(sourceRoot) + sep)) throw new Error("Copilot settings dependency escaped its source root");
    ordinaryCopilotPath(absolute, false);
    paths.add(path);
    if (!path.endsWith(".ts")) return;
    const source = readFileSync(absolute, "utf8");
    for (const dependency of scanner.scanImports(source.replace(/^#![^\n]*\n/, "\n"))) {
      if (dependency.path === "bun:ffi" || dependency.path.startsWith("node:") && isBuiltin(dependency.path)) continue;
      if (!dependency.path.startsWith(".")) throw new Error(`Copilot settings do not admit unwitnessed imports: ${dependency.path}`);
      const target = relative(sourceRoot, Bun.resolveSync(dependency.path, dirname(absolute))).split(sep).join("/");
      if (!target.endsWith(".ts")) throw new Error("Copilot settings imports require source TypeScript modules");
      visit(target);
    }
  };
  ["harness/copilot/settings.ts", "harness/copilot/manifest.ts", "core/templates/onboarding.md", "core/templates/onboarding-harness.md", "package.json", "bun.lock"].forEach(visit);
  return [...paths].sort().map(path => ({ path, sha256: new Bun.CryptoHasher("sha256").update(readFileSync(join(sourceRoot, path))).digest("hex") }));
}

// Core assets and source-executed policy modules form this producer's declared input universe.
// Observe it independently; helper-reported witness lists cannot omit or substitute inputs.
export function observeCopilotProductionInputs(sourceRoot: string): readonly SourceContentDigest[] {
  ordinaryCopilotPath(sourceRoot, true);
  const paths: string[] = [];
  const visit = (path: string): void => {
    const absolute = join(sourceRoot, path), stat = lstatSync(absolute);
    ordinaryCopilotPath(absolute, stat.isDirectory());
    if (stat.isDirectory()) for (const name of readdirSync(absolute).sort()) visit(`${path}/${name}`);
    else if (path !== "core/markdown.d.ts") paths.push(path);
  };
  ["core", "harness", "scripts", "package.json", "bun.lock"].forEach(visit);
  return paths.sort().map(path => ({ path, sha256: new Bun.CryptoHasher("sha256").update(readFileSync(join(sourceRoot, path))).digest("hex") }));
}
export function verifyCopilotProductionInputs(expected: readonly SourceContentDigest[], actual: readonly SourceContentDigest[]): void {
  if (actual.length !== expected.length || expected.some(input => actual.filter(witness => witness.path === input.path && witness.sha256 === input.sha256).length !== 1)) throw new Error("Copilot artifact requires every independently observed production input exactly once: " + JSON.stringify({ missing: expected.filter(input => !actual.some(witness => witness.path === input.path && witness.sha256 === input.sha256)).map(input => input.path), extra: actual.filter(input => !expected.some(witness => witness.path === input.path)).map(input => input.path), expected: expected.length, actual: actual.length }));
}

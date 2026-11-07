import { isBuiltin } from "node:module";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { SourceContentDigest } from "../domain/source-origin.ts";
const rootModules = ["harness/kiro-ide/settings.ts"];
const dataRoots = ["harness/kiro-ide/agents", "harness/kiro-ide/hooks", "harness/kiro-ide/settings", "harness/kiro-ide/steering", "core/memory"];
export function ordinaryKasPath(root: string, path = ""): void {
  if (!isAbsolute(root)) throw new Error("KAS policy requires absolute source and working roots");
  const absolute = resolve(root, path);
  if (absolute !== root && !absolute.startsWith(root + sep)) throw new Error("KAS source path escaped its root");
  let current = absolute;
  while (true) {
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || (current !== absolute || path === "" ? !stat.isDirectory() : !stat.isFile())) throw new Error(`KAS preparation requires ordinary source and working paths: ${current}`);
    const parent = dirname(current); if (parent === current) break; current = parent;
  }
}
export function observeKasInputs(sourceRoot: string): readonly SourceContentDigest[] {
  ordinaryKasPath(sourceRoot);
  const paths = new Set<string>();
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const visit = (path: string) => {
    if (paths.has(path)) return;
    ordinaryKasPath(sourceRoot, path); paths.add(path);
    if (!path.endsWith(".ts")) return;
    for (const item of transpiler.scanImports(readFileSync(join(sourceRoot, path), "utf8").replace(/^#![^\n]*\n/, "\n"))) {
      if (!item.path.startsWith(".")) {
        if ((item.path.startsWith("node:") && isBuiltin(item.path)) || ["bun:ffi", "zod", "js-yaml"].includes(item.path)) continue;
        throw new Error(`KAS policy does not admit unwitnessed external source imports: ${item.path}`);
      }
      const target = relative(sourceRoot, Bun.resolveSync(item.path, join(sourceRoot, dirname(path)))).split(sep).join("/");
      if (target.startsWith("../") || !/[.](?:ts|json|md)$/.test(target)) throw new Error(`KAS dependency requires an ordinary in-source TypeScript module: ${target}`);
      visit(target);
    }
  };
  const directory = (path: string) => {
    const stat = lstatSync(join(sourceRoot, path)); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`KAS inputs require ordinary directories: ${path}`);
    for (const entry of readdirSync(join(sourceRoot, path), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const child = `${path}/${entry.name}`; if (entry.isDirectory()) directory(child); else { ordinaryKasPath(sourceRoot, child); paths.add(child); }
    }
  };
  rootModules.forEach(visit); dataRoots.forEach(directory);
  ["package.json", "bun.lock"].forEach(visit);
  return [...paths].sort().map(path => ({ path, sha256: new Bun.CryptoHasher("sha256").update(readFileSync(join(sourceRoot, path))).digest("hex") }));
}

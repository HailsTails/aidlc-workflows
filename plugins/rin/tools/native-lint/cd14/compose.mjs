#!/usr/bin/env bun
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { biomeCd14, oxlintCd14 } from "./config.mjs";

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const all = (flag) => args.flatMap((arg, index) => arg === flag ? [args[index + 1]] : []);
const projectDir = resolve(value("--project-dir") ?? process.cwd());
const inside = (path) => {
  const absolute = resolve(projectDir, path ?? "");
  const rel = relative(projectDir, absolute);
  if (!path || isAbsolute(path) || rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error(`expected a project-relative path: ${path ?? "(missing)"}`);
  }
  return absolute;
};

const engine = value("--engine");
const hostFile = inside(value("--host"));
const outputFile = inside(value("--output"));
const pluginPath = value("--plugin-path");
if (hostFile === outputFile || !existsSync(hostFile)) {
  throw new Error("provide a separate existing host config; the host file is never overwritten");
}
if (!pluginPath || !existsSync(resolve(dirname(outputFile), pluginPath))) {
  throw new Error("the local CD-14 plugin path must resolve beside the output config");
}
if (engine === "biome" && dirname(hostFile) !== dirname(outputFile)) {
  throw new Error("keep the Biome host and output in the same directory to preserve relative config paths");
}
const host = JSON.parse(readFileSync(hostFile, "utf8"));
const composed = engine === "oxlint"
  ? oxlintCd14({ projectDir, host, pluginPath })
  : engine === "biome"
    ? biomeCd14({
        projectDir,
        host,
        hostPath: `./${relative(dirname(outputFile), hostFile).replaceAll("\\", "/")}`,
        pluginPath,
        includes: all("--include"),
      })
    : (() => { throw new Error("--engine must be oxlint or biome"); })();
writeFileSync(outputFile, `${JSON.stringify(composed, null, 2)}\n`);
process.stdout.write(`Composed CD-14 ${engine} config at ${outputFile}.\n`);

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import plugin from "./plugin.mjs";

export const ruleId = "rin-discipline/no-class-authoring";
const sidecarPath = (projectDir) => join(projectDir, ".constitution-carve-outs", "cd-14.json");
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

// Mechanical projection only. Rin's canonical CD sensor and CD-46 gate still own
// eligibility, why-chain policy, stale findings and touched-file decay.
export function cd14CarvedFiles(projectDir) {
  const root = realpathSync(resolve(projectDir));
  const sidecar = sidecarPath(root);
  if (!existsSync(sidecar)) return [];
  const entries = JSON.parse(readFileSync(sidecar, "utf8"));
  if (!Array.isArray(entries)) throw new Error("CD-14 carve-out sidecar must be an array");
  const files = entries.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
        !Array.isArray(entry.files) || entry.files.length === 0 ||
        !nonempty(entry.reason) || !nonempty(entry.decision)) {
      throw new Error(`CD-14 carve-out entry ${index} needs files, reason and decision`);
    }
    return entry.files.map((file) => {
      if (typeof file !== "string" || !file || file.includes("\\") ||
          isAbsolute(file) || posix.normalize(file) !== file ||
          file.startsWith("../") || file.startsWith("/") ||
          /[*?![\]{}]/u.test(file)) {
        throw new Error(`CD-14 carve-out requires an exact relative file: ${file}`);
      }
      const absolute = resolve(root, file);
      const actual = existsSync(absolute) ? relative(root, realpathSync(absolute)) : "..";
      if (!existsSync(absolute) || !statSync(absolute).isFile() ||
          actual === ".." || actual.startsWith(`..${sep}`) || isAbsolute(actual)) {
        throw new Error(`CD-14 carve-out requires an existing file inside the project: ${file}`);
      }
      return file;
    });
  });
  return [...new Set(files)].sort();
}

const onlyRuleOff = (file) => ({ files: [file], rules: { [ruleId]: "off" } });
const scope = (files) => {
  if (!Array.isArray(files) || files.length === 0 || !files.every(nonempty)) {
    throw new Error("CD-14 needs a nonempty selected lint file population");
  }
  return files;
};

// Append these entries after the consumer's existing ESLint flat config. The
// consumer keeps ownership of its parser, ignores and unrelated rules.
export function eslintCd14({ projectDir, files }) {
  return [
    {
      files: scope(files),
      plugins: { "rin-discipline": plugin },
      rules: { [ruleId]: "error" },
    },
    ...cd14CarvedFiles(projectDir).map(onlyRuleOff),
  ];
}

export function oxlintCd14({ projectDir, host, pluginPath }) {
  if (!nonempty(pluginPath)) throw new Error("CD-14 Oxlint needs its local JS plugin path");
  if (Object.hasOwn(host.rules ?? {}, ruleId) ||
      (host.overrides ?? []).some((row) => Object.hasOwn(row.rules ?? {}, ruleId)) ||
      (host.jsPlugins ?? []).includes(pluginPath)) {
    throw new Error("host Oxlint config already owns the CD-14 rule or plugin");
  }
  return {
    ...host,
    jsPlugins: [...(host.jsPlugins ?? []), pluginPath],
    rules: { ...host.rules, [ruleId]: "error" },
    overrides: [...(host.overrides ?? []), ...cd14CarvedFiles(projectDir).map(onlyRuleOff)],
  };
}

export function biomeCd14({ projectDir, hostPath, host, pluginPath, includes }) {
  if (!nonempty(hostPath) || !nonempty(pluginPath) ||
      (host.plugins ?? []).some((item) => (typeof item === "string" ? item : item.path) === pluginPath)) {
    throw new Error("Biome needs a separate host config and one new CD-14 Grit plugin");
  }
  const hostExtends = host.extends ?? [];
  if (!Array.isArray(hostExtends) || !hostExtends.every((entry) => nonempty(entry) && entry !== "//")) {
    throw new Error("Biome host extends must be an array of explicit config paths");
  }
  const carvedFiles = cd14CarvedFiles(projectDir);
  const root = resolve(projectDir).split(sep).join("/");
  if (carvedFiles.length > 0 && /[*?![\]{}]/u.test(root)) {
    throw new Error("Biome exact-file carve-outs need a project path without glob characters");
  }
  return {
    $schema: "https://biomejs.dev/schemas/2.5.15/schema.json",
    // Biome does not recursively follow extends in an extended host config.
    extends: [...hostExtends, hostPath],
    plugins: [{
      path: pluginPath,
      includes: [
        ...scope(includes),
        ...carvedFiles.map((file) => `!${root}/${file}`),
      ],
    }],
  };
}

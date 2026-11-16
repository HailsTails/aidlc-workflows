import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import type { FileTree } from "../domain/install-lifecycle.ts";
import type { InstallLab, InstallProject, RuntimeChoice } from "../application/ports.ts";

export type LabPlacement = {
  readonly sandbox: string;
  readonly runtimes: Readonly<Record<RuntimeChoice, string>>;
  readonly searchPath: string;
  readonly systemRoot: string;
};

type Sandbox = {
  readonly placement: LabPlacement;
  readonly harness: string;
  readonly root: string;
  readonly environment: Record<string, string>;
};

type RuntimeQuery = {
  readonly tool: string;
  readonly script: string;
  readonly args: readonly string[];
};

const StampSchema = z.object({ frameworkVersion: z.string(), harnessDir: z.string() });

const ManifestSchema = z.object({
  files: z.record(z.string(), z.string()),
  entries: z.record(z.string(), z.unknown()).optional(),
  rootContributions: z.record(z.string(), z.unknown()).optional(),
});

const PERSON_FILES: Readonly<Record<string, string>> = {
  "README.md": "# greeter\n\nA tiny command-line greeter.\n",
  ".gitignore": "node_modules/\n",
  "AGENTS.md": "# Team notes\n\nRun the tests before you push.\n",
};

const COPY_OMITS = [
  "const { copyChannelOmits, projectionFiles } = await import(tool);",
  "console.log(JSON.stringify([...copyChannelOmits(projectionFiles(args[0]).descriptor)]));",
].join("\n");

const HARNESS_NAME = [
  "const { harnessNameFor } = await import(tool);",
  "console.log(JSON.stringify(harnessNameFor(args[0], args[1])));",
].join("\n");

const QUERY_PRELUDE = "const [tool, ...args] = JSON.parse(process.argv.at(-1));";

const harnessDirOf = (root: string): string => {
  const folder = readdirSync(root).find((name) =>
    existsSync(join(root, name, "tools", "data", "aidlc-stamp.json")),
  );
  return folder ?? "";
};

const stampOf = (root: string): z.infer<typeof StampSchema> => {
  const path = join(root, harnessDirOf(root), "tools", "data", "aidlc-stamp.json");
  return StampSchema.parse(JSON.parse(readFileSync(path, "utf8")));
};

const toolOf = (root: string, file: string): string =>
  join(root, harnessDirOf(root), "tools", file);

const childEnvironment = (placement: LabPlacement, root: string): Record<string, string> => {
  const home = join(root, "home");
  const temp = join(root, "temp");
  const globalGit = join(root, "gitconfig");
  mkdirSync(temp, { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(globalGit, "[user]\n\tname = Person\n\temail = person@example.com\n");
  return {
    PATH: placement.searchPath,
    SystemRoot: placement.systemRoot,
    HOME: home,
    USERPROFILE: home,
    APPDATA: join(home, "AppData", "Roaming"),
    LOCALAPPDATA: join(home, "AppData", "Local"),
    XDG_DATA_HOME: join(home, ".local", "share"),
    XDG_CONFIG_HOME: join(home, ".config"),
    AIDLC_INSTALL_ROOT: join(home, "aidlc-machine"),
    TEMP: temp,
    TMP: temp,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: globalGit,
  };
};

const askRuntime = (sandbox: Sandbox, query: RuntimeQuery): unknown => {
  const payload = JSON.stringify([pathToFileURL(query.tool).href, ...query.args]);
  const script = `${QUERY_PRELUDE}\n${query.script}`;
  const run = spawnSync(process.execPath, ["--eval", script, payload], {
    env: sandbox.environment,
    encoding: "utf8",
  });
  return JSON.parse(run.stdout);
};

const copyRuntimeOf = (sandbox: Sandbox, runtime: RuntimeChoice): string => {
  const target = join(sandbox.root, `runtime-${runtime}`, "runtime", sandbox.harness);
  if (existsSync(target)) {
    return target;
  }
  const shipped = join(sandbox.placement.runtimes[runtime], sandbox.harness);
  cpSync(shipped, target, { recursive: true });
  const tool = toolOf(shipped, "aidlc-distribution.ts");
  const omits = z
    .array(z.string())
    .parse(askRuntime(sandbox, { tool, script: COPY_OMITS, args: [shipped] }));
  for (const path of omits) {
    rmSync(join(target, path), { force: true });
  }
  return target;
};

const harnessNameFor = (sandbox: Sandbox, project: string): string => {
  const current = join(sandbox.placement.runtimes.current, sandbox.harness);
  const tool = toolOf(current, "aidlc-runtime-paths.ts");
  const args = [sandbox.harness, toolOf(project, "aidlc.ts")];
  return z.string().parse(askRuntime(sandbox, { tool, script: HARNESS_NAME, args }));
};

const hashTree = (root: string): FileTree => {
  const files: Record<string, string> = {};
  const walk = (folder: string): void => {
    readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.name !== ".git" || !entry.isDirectory())
      .forEach((entry) => {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) {
          walk(path);
          return;
        }
        const key = relative(root, path).replaceAll("\\", "/");
        files[key] = createHash("sha256").update(readFileSync(path)).digest("hex");
      });
  };
  walk(root);
  return Object.fromEntries(Object.entries(files).toSorted(([a], [b]) => a.localeCompare(b)));
};

const seededProject = (sandbox: Sandbox): string => {
  const project = join(sandbox.root, "project");
  mkdirSync(project, { recursive: true });
  for (const [name, text] of Object.entries(PERSON_FILES)) {
    writeFileSync(join(project, name), text);
  }
  spawnSync("git", ["init", "-q"], { cwd: project, env: sandbox.environment });
  return project;
};

const ownedSampleIn = (project: string): string => {
  const path = toolOf(project, join("data", "aidlc-manifest.json"));
  const manifest = ManifestSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const shared = new Set([
    ...Object.keys(manifest.entries ?? {}),
    ...Object.keys(manifest.rootContributions ?? {}),
  ]);
  const markdown = Object.keys(manifest.files).filter(
    (file) => file.endsWith(".md") && !shared.has(file),
  );
  return markdown.toSorted((a, b) => a.localeCompare(b))[0] ?? "";
};

const installProject = (sandbox: Sandbox): InstallProject => {
  const project = seededProject(sandbox);
  return {
    copyIn: (runtime) => {
      cpSync(copyRuntimeOf(sandbox, runtime), project, { recursive: true });
    },
    config: (request) => {
      const from = copyRuntimeOf(sandbox, request.runtime);
      const name = harnessNameFor(sandbox, project);
      const force = request.force ? ["--force"] : [];
      const argv = [toolOf(project, "aidlc.ts"), "config", "--from", from, "--harness", name];
      const run = spawnSync(process.execPath, [...argv, ...force, "--yes"], {
        cwd: project,
        env: sandbox.environment,
        encoding: "utf8",
      });
      return { exitCode: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
    },
    ownedSample: () => ownedSampleIn(project),
    append: (path) => appendFileSync(join(project, path), "\nA note of my own.\n"),
    tree: () => hashTree(project),
  };
};

export const copyInstallLab = (placement: LabPlacement): InstallLab => ({
  releaseOf: (runtime) => stampOf(join(placement.runtimes[runtime], "claude")).frameworkVersion,
  project: (harness) => {
    mkdirSync(placement.sandbox, { recursive: true });
    const root = mkdtempSync(join(placement.sandbox, `${harness}-`));
    const environment = childEnvironment(placement, root);
    return installProject({ placement, harness, root, environment });
  },
});

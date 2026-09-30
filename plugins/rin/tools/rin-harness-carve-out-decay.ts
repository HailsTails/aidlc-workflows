import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllOwnedCarveOuts } from "./rin-harness-cd-carve-outs.ts";

const UPSTREAM_FINDINGS_COUNT_KEY = "findings_count";
const HOOK_VIOLATIONS_COUNT_KEY = "violations_count";

type Breach = {
  readonly file: string;
  readonly cdCode: string;
  readonly decision: string;
  readonly reason: string;
};

type GitFailure = {
  readonly args: readonly string[];
  readonly message: string;
};

type ChangedFiles =
  | { readonly result: "success"; readonly files: readonly string[] }
  | { readonly result: "failure"; readonly failure: GitFailure };

type Flags = {
  readonly projectDir: string;
  readonly baseRef: string;
  readonly json: boolean;
};

const DEFAULT_BASE_REF = "HEAD";

const toPosix = (filePath: string): string => filePath.replace(/\\/g, "/");

const parseFlags = (argv: readonly string[]): Flags => {
  const findValue = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    projectDir: resolve(findValue("--project-dir") ?? process.cwd()),
    baseRef: findValue("--base-ref") ?? DEFAULT_BASE_REF,
    json: argv.includes("--json"),
  };
};

const parseGitNameOnly = (rawOutput: string): readonly string[] =>
  rawOutput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(toPosix);

type GitRun =
  | { readonly result: "success"; readonly stdout: string }
  | { readonly result: "failure"; readonly failure: GitFailure };

const runGit = (projectDir: string, args: readonly string[]): GitRun => {
  try {
    return {
      result: "success",
      stdout: execFileSync("git", args, { cwd: projectDir, encoding: "utf-8" }),
    };
  } catch (error) {
    return {
      result: "failure",
      failure: {
        args,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
};

const changedFiles = (projectDir: string, baseRef: string): ChangedFiles => {
  const runs = [
    ["diff", "--name-only", `${baseRef}...HEAD`],
    ["diff", "--name-only", "HEAD"],
    ["ls-files", "--others", "--exclude-standard"],
  ].map((args) => runGit(projectDir, args));

  const firstFailure = runs.find(
    (run): run is Extract<GitRun, { result: "failure" }> =>
      run.result === "failure",
  );
  if (firstFailure) {
    return { result: "failure", failure: firstFailure.failure };
  }

  const files = [
    ...new Set(
      runs.flatMap((run) =>
        run.result === "success" ? parseGitNameOnly(run.stdout) : [],
      ),
    ),
  ];
  return { result: "success", files };
};

// A carved file that only MOVED is not a touch: its content is what the
// carve-out describes, and relocating it changes nothing the exemption covers.
// The test is content identity, NOT git's rename detection — that is a
// similarity heuristic which both misses a move whose content also shifted and
// invents one between unrelated files. This asks a exact question instead: does
// this exact blob already exist somewhere in the base ref? A file whose bytes
// are unchanged answers yes wherever it now sits; one edited by even a line
// answers no and is correctly reported as touched.
const contentExistsInBaseRef = (args: {
  readonly projectDir: string;
  readonly baseRef: string;
  readonly file: string;
}): boolean => {
  const hashed = runGit(args.projectDir, ["hash-object", args.file]);
  if (hashed.result !== "success") return false;
  const blob = hashed.stdout.trim();
  if (blob === "") return false;
  // `cat-file -e` asks whether the object exists, cheaply and by exact id. It is
  // deliberately not `ls-tree -r <ref>`: that lists the whole tree, which on a
  // repo this size overflows execFileSync's output buffer and throws, silently
  // turning every lookup into a false "not present".
  const reachable = runGit(args.projectDir, [
    "cat-file",
    "-e",
    `${blob}^{blob}`,
  ]);
  return reachable.result === "success";
};

const findBreaches = (args: {
  readonly changed: readonly string[];
  readonly projectDir: string;
  readonly baseRef: string;
}): readonly Breach[] => {
  const { changed, projectDir, baseRef } = args;
  const changedNorm = changed.map(toPosix);
  const isChanged = (carvedFile: string): boolean => {
    const carvedNorm = toPosix(carvedFile);
    const named = changedNorm.some(
      (changedFile) =>
        changedFile === carvedNorm ||
        changedFile.endsWith(carvedNorm) ||
        carvedNorm.endsWith(changedFile),
    );
    if (!named) return false;
    return !contentExistsInBaseRef({ projectDir, baseRef, file: carvedFile });
  };
  return loadAllOwnedCarveOuts({ projectDir }).flatMap((carveOut) =>
    carveOut.files
      .filter((carvedFile) => isChanged(carvedFile))
      .map((carvedFile) => ({
        file: toPosix(carvedFile),
        cdCode: carveOut.cd,
        decision: carveOut.decision,
        reason: carveOut.reason,
      })),
  );
};

const emitGitFailure = (failure: GitFailure, json: boolean): void => {
  const gitCommand = `git ${failure.args.join(" ")}`;
  const detail =
    `could not determine the changed-file set — \`${gitCommand}\` failed ` +
    `(${failure.message.trim()}). A gate that cannot read its input FAILS, it does ` +
    `not pass. Common cause: an unresolvable base ref (e.g. origin/main in a ` +
    `worktree that has not fetched). Run \`git fetch origin\` or pass a resolvable ` +
    "--base-ref.";
  if (json) {
    const wire: Record<string, unknown> = {
      pass: false,
      [UPSTREAM_FINDINGS_COUNT_KEY]: 1,
      findings: [
        { file: gitCommand, cdCode: "CD-46", decision: "", reason: detail },
      ],
      [HOOK_VIOLATIONS_COUNT_KEY]: 1,
      violations: [
        {
          rule: "CD-46 (carve-out decay — git failure)",
          file: gitCommand,
          line: 0,
          snippet: detail,
        },
      ],
    };
    process.stdout.write(`${JSON.stringify(wire)}\n`);
  } else {
    process.stdout.write(
      `CD-46 carve-out decay: FAIL (git error) — ${detail}\n`,
    );
  }
};

const main = (): void => {
  const flags = parseFlags(process.argv.slice(2));
  const changed = changedFiles(flags.projectDir, flags.baseRef);

  if (changed.result === "failure") {
    emitGitFailure(changed.failure, flags.json);
    process.exit(1);
  }

  const breaches = findBreaches({
    changed: changed.files,
    projectDir: flags.projectDir,
    baseRef: flags.baseRef,
  });
  const pass = breaches.length === 0;

  if (flags.json) {
    const violations = breaches.map((breach) => ({
      rule: `${breach.cdCode} (carve-out decay)`,
      file: breach.file,
      line: 0,
      snippet: `carved by decision ${breach.decision || "(none)"} — touching forfeits the carve-out`,
    }));
    const wire: Record<string, unknown> = {
      pass,
      [UPSTREAM_FINDINGS_COUNT_KEY]: breaches.length,
      findings: breaches,
      [HOOK_VIOLATIONS_COUNT_KEY]: breaches.length,
      violations,
    };
    process.stdout.write(`${JSON.stringify(wire)}\n`);
  } else if (pass) {
    process.stdout.write(
      "CD-46 carve-out decay: PASS — no carved file was touched.\n",
    );
  } else {
    process.stdout.write(
      `CD-46 carve-out decay: FAIL — ${breaches.length} carved file(s) touched under an active carve-out.\n`,
    );
    breaches.forEach((breach) => {
      process.stdout.write(
        `  [${breach.cdCode}] ${breach.file} (decision ${breach.decision || "none"}) — ` +
          `touching a carved file forfeits its carve-out. Pay down the violations and delete the entry.\n`,
      );
    });
  }

  process.exit(pass ? 0 : 1);
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) main();

export type { Breach };
export { changedFiles, findBreaches };

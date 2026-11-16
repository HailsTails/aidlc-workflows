export type Identity = {
  readonly name: string;
  readonly email: string;
  readonly date: string;
};

export type CommitRequest = {
  readonly tree: string;
  readonly parent: string;
  readonly message: string;
  readonly author: Identity;
  readonly committer: Identity;
};

export type Git = {
  readonly resolve: (revision: string) => string;
  readonly show: (revision: string, path: string) => string;
  readonly identityOf: (revision: string) => { readonly author: Identity; readonly committer: Identity };
  readonly treeOf: (revision: string) => string | undefined;
  readonly readTree: (revision: string) => void;
  readonly indexedPaths: () => readonly string[];
  readonly entriesAt: (revision: string, paths: readonly string[]) => ReadonlyMap<string, string>;
  readonly updateIndex: (lines: readonly string[]) => void;
  readonly applyToIndex: (patchFile: string) => void;
  readonly storeBlob: (content: string) => string;
  readonly writeTree: () => string;
  readonly commitTree: (request: CommitRequest) => string;
  readonly updateBranch: (branch: string, commit: string) => void;
};

const EMPTY_BLOB_ENTRY = "0 0000000000000000000000000000000000000000";

type Run = {
  readonly args: readonly string[];
  readonly input?: string;
  readonly environment?: Readonly<Record<string, string>>;
};

const runner =
  (repository: string, indexFile: string) =>
  (run: Run): string => {
    const result = Bun.spawnSync(["git", "-C", repository, ...run.args], {
      env: { ...process.env, GIT_INDEX_FILE: indexFile, ...run.environment },
      stdin: run.input === undefined ? "ignore" : Buffer.from(run.input),
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) {
      throw new Error(`git ${run.args.join(" ")} failed: ${result.stderr.toString()}`);
    }
    return result.stdout.toString();
  };

const identityFrom = (fields: readonly string[], offset: number): Identity => ({
  name: fields[offset] ?? "",
  email: fields[offset + 1] ?? "",
  date: fields[offset + 2] ?? "",
});

const identityEnvironment = (role: "AUTHOR" | "COMMITTER", identity: Identity): Record<string, string> => ({
  [`GIT_${role}_NAME`]: identity.name,
  [`GIT_${role}_EMAIL`]: identity.email,
  [`GIT_${role}_DATE`]: identity.date,
});

const entryPairs = (listing: string): ReadonlyMap<string, string> =>
  new Map(
    listing
      .split("\0")
      .filter((line) => line !== "")
      .map((line) => {
        const [meta = "", path = ""] = line.split("\t");
        return [path, meta] as const;
      }),
  );

export const removalLine = (path: string): string => `${EMPTY_BLOB_ENTRY}\t${path}`;

export const entryLine = (meta: string, path: string): string => `${meta}\t${path}`;

export const gitIn = (repository: string, indexFile: string): Git => {
  const git = runner(repository, indexFile);
  return {
    resolve: (revision) => git({ args: ["rev-parse", "--verify", `${revision}^{commit}`] }).trim(),
    show: (revision, path) => git({ args: ["show", `${revision}:${path}`] }),
    identityOf: (revision) => {
      const fields = git({ args: ["log", "-1", "--date=raw", "--format=%an%x00%ae%x00%ad%x00%cn%x00%ce%x00%cd", revision] })
        .trim()
        .split("\0");
      return { author: identityFrom(fields, 0), committer: identityFrom(fields, 3) };
    },
    treeOf: (revision) => {
      try {
        return git({ args: ["rev-parse", "--verify", "--quiet", `${revision}^{tree}`] }).trim();
      } catch {
        return undefined;
      }
    },
    readTree: (revision) => {
      git({ args: ["read-tree", revision] });
    },
    indexedPaths: () => git({ args: ["ls-files", "-z"] }).split("\0").filter((path) => path !== ""),
    entriesAt: (revision, paths) => entryPairs(git({ args: ["ls-tree", "-z", revision, "--", ...paths] })),
    updateIndex: (lines) => {
      if (lines.length > 0) git({ args: ["update-index", "--index-info"], input: `${lines.join("\n")}\n` });
    },
    applyToIndex: (patchFile) => {
      git({ args: ["apply", "--cached", patchFile] });
    },
    storeBlob: (content) => git({ args: ["hash-object", "-w", "--stdin"], input: content }).trim(),
    writeTree: () => git({ args: ["write-tree"] }).trim(),
    commitTree: (request) =>
      git({
        args: ["commit-tree", request.tree, "-p", request.parent],
        input: request.message,
        environment: {
          ...identityEnvironment("AUTHOR", request.author),
          ...identityEnvironment("COMMITTER", request.committer),
        },
      }).trim(),
    updateBranch: (branch, commit) => {
      git({ args: ["update-ref", `refs/heads/${branch}`, commit] });
    },
  };
};

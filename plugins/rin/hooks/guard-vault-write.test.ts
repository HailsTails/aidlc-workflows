import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  readConfig,
  type VaultConfigurationReader,
} from "../tools/rin-harness-config.ts";
import {
  evaluateVaultWrite,
  type HookInvocation,
  handleVaultWriteInvocation,
  parseHookInvocation,
  type VaultGuardEnvironment,
} from "./guard-vault-write.ts";
import { runRanHookProcess } from "./run-hook-process.ts";

const hookFileName = "guard-vault-write.ts";
const fixtureDirectories: string[] = [];
const aidlcCompiledExecutableVariable = "AIDLC_COMPILED_EXECUTABLE";
const aidlcProjectDirectoryVariable = "AIDLC_PROJECT_DIR";
const claudeProjectDirectoryVariable = "CLAUDE_PROJECT_DIR";
const toolNameWireField = "tool_name";
const toolInputWireField = "tool_input";
const filePathWireField = "file_path";

const inheritedEnvironment = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined &&
        entry[0] !== "AIDLC_PROJECT_DIR" &&
        entry[0] !== "CLAUDE_PROJECT_DIR",
    ),
  );

const createProjectDirectory = ({
  contents,
  unreadable = false,
}: {
  readonly contents: string | null;
  readonly unreadable?: boolean;
}): string => {
  const projectDirectory = mkdtempSync(join(tmpdir(), "vault-hook-"));
  fixtureDirectories.push(projectDirectory);
  const configurationPath = join(projectDirectory, "harness.config.json");
  if (unreadable) mkdirSync(configurationPath);
  else if (contents !== null) writeFileSync(configurationPath, contents);
  return projectDirectory;
};

const configuredContents = ({
  pathMarker,
}: {
  readonly pathMarker: string;
}): string =>
  JSON.stringify({
    projectName: "fixture",
    defaultScope: "workshop",
    rulesetRoot: "memory",
    stageGraph: "graph.json",
    packageManager: { primary: "bun", runnerAllowlist: [] },
    mechanisms: {
      vaultWritePolicy: { adapter: "mcp-only", pathMarker },
    },
  });

const configuredProjectDirectory = ({
  pathMarker,
}: {
  readonly pathMarker: string;
}): string =>
  createProjectDirectory({ contents: configuredContents({ pathMarker }) });

const invocation = ({
  toolName = "Write",
  filePath,
  cwd,
}: {
  readonly toolName?: string;
  readonly filePath: string;
  readonly cwd?: string;
}): HookInvocation => ({
  toolName,
  filePath,
  cwd: cwd ?? null,
});

const invocationPayload = ({
  toolName = "Write",
  filePath,
  cwd,
}: {
  readonly toolName?: string;
  readonly filePath: string;
  readonly cwd?: string;
}): string =>
  JSON.stringify({
    [toolNameWireField]: toolName,
    [toolInputWireField]: { [filePathWireField]: filePath },
    ...(cwd === undefined ? {} : { cwd }),
  });

const runHook = ({
  stdinPayload,
  processDirectory,
  environment = {},
}: {
  readonly stdinPayload: string;
  readonly processDirectory: string;
  readonly environment?: VaultGuardEnvironment;
}) =>
  runRanHookProcess({
    hookFileName,
    runtime: "bun",
    stdinPayload,
    cwd: processDirectory,
    env: {
      ...inheritedEnvironment(),
      [aidlcCompiledExecutableVariable]: "/fixture/compiled-aidlc",
      ...environment,
    },
  });

afterEach(() => {
  fixtureDirectories.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
});

describe("vault policy outcomes", () => {
  test("keeps root and configuration resolution outside the pure guard", () => {
    const projectDirectory = configuredProjectDirectory({
      pathMarker: "Fixture/Private Notes",
    });
    const vaultPolicy = readConfig({ projectDir: projectDirectory }).config
      .mechanisms.vaultWritePolicy;
    expect(
      evaluateVaultWrite({
        toolInput: {
          toolName: "Write",
          filePath: "/home/FIXTURE/private notes/note.md",
        },
        vaultPolicy,
      }),
    ).toMatchObject({ outcome: "denied" });
  });

  test.each([
    {
      name: "missing",
      contents: null,
      unreadable: false,
      expected: { outcome: "allowed" },
    },
    {
      name: "unreadable",
      contents: null,
      unreadable: true,
      expected: {
        outcome: "denied",
        reason: "Blocked: vault write policy configuration-unreadable.",
      },
    },
    {
      name: "malformed",
      contents: "{",
      unreadable: false,
      expected: {
        outcome: "denied",
        reason: "Blocked: vault write policy configuration-malformed.",
      },
    },
    {
      name: "invalid",
      contents: "{}",
      unreadable: false,
      expected: {
        outcome: "denied",
        reason:
          "Blocked: vault write policy configuration-invalid at projectName.",
      },
    },
    {
      name: "configured",
      contents: configuredContents({ pathMarker: "Fixture/Private Notes" }),
      unreadable: false,
      expected: {
        outcome: "denied",
        reason:
          "Blocked: direct disk write into the Obsidian vault. Vault edits go through the Obsidian MCP (mcp__obsidian__* / obsidian_update_note). If the MCP is unavailable, keep output inline and report the MCP gap - never disk-write the vault.",
      },
    },
  ])("maps $name configuration through one injected reader", ({
    contents,
    unreadable,
    expected,
  }) => {
    const projectDirectory = createProjectDirectory({ contents, unreadable });
    const consumers: string[] = [];
    const reader: VaultConfigurationReader = {
      readConfiguration: (consumer) => {
        consumers.push(consumer.projectDir);
        return readConfig(consumer);
      },
    };
    expect(
      handleVaultWriteInvocation({
        invocation: invocation({
          filePath: "/home/FIXTURE/private notes/note.md",
          cwd: projectDirectory,
        }),
        reader,
        environment: {
          [aidlcProjectDirectoryVariable]: "/stale/aidlc",
          [claudeProjectDirectoryVariable]: "/stale/claude",
        },
        currentWorkingDirectory: "/stale/process",
      }),
    ).toEqual(expected);
    expect(consumers).toEqual([projectDirectory]);
  });
});

describe("source hook adapter", () => {
  test.each([
    {
      toolName: "Write",
      marker: "Fixture/Private Notes",
      filePath: "/home/FIXTURE/private notes/note.md",
    },
    {
      toolName: "Edit",
      marker: "Another\\Protected Space",
      filePath: "C:\\root\\ANOTHER\\protected space\\note.md",
    },
  ])("denies a case-insensitive $toolName path for $marker", async ({
    toolName,
    marker,
    filePath,
  }) => {
    const projectDirectory = configuredProjectDirectory({ pathMarker: marker });
    const outcome = await runHook({
      processDirectory: createProjectDirectory({ contents: null }),
      stdinPayload: invocationPayload({
        toolName,
        filePath,
        cwd: projectDirectory,
      }),
    });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("mcp__obsidian__* / obsidian_update_note");
  });

  test("uses invocation cwd before stale project environment and process cwd", async () => {
    const selectedProject = configuredProjectDirectory({
      pathMarker: "Selected/Notes",
    });
    const staleProject = configuredProjectDirectory({
      pathMarker: "Stale/Notes",
    });
    const processDirectory = createProjectDirectory({ contents: null });
    const outcome = await runHook({
      processDirectory,
      environment: {
        [aidlcProjectDirectoryVariable]: staleProject,
        [claudeProjectDirectoryVariable]: staleProject,
      },
      stdinPayload: invocationPayload({
        filePath: "/home/SELECTED/notes/note.md",
        cwd: selectedProject,
      }),
    });
    expect(outcome.exitCode).toBe(2);
  });

  test.each([
    { environmentName: aidlcProjectDirectoryVariable },
    { environmentName: claudeProjectDirectoryVariable },
  ])("falls back through $environmentName", async ({ environmentName }) => {
    const selectedProject = configuredProjectDirectory({
      pathMarker: "Environment/Notes",
    });
    const processDirectory = createProjectDirectory({ contents: null });
    const outcome = await runHook({
      processDirectory,
      environment: { [environmentName]: selectedProject },
      stdinPayload: invocationPayload({
        filePath: "/home/environment/notes/note.md",
      }),
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("falls back to the process cwd", async () => {
    const projectDirectory = configuredProjectDirectory({
      pathMarker: "Process/Notes",
    });
    const outcome = await runHook({
      processDirectory: projectDirectory,
      stdinPayload: invocationPayload({
        filePath: "/home/process/notes/note.md",
      }),
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("keeps missing configuration neutral", async () => {
    const projectDirectory = createProjectDirectory({ contents: null });
    const outcome = await runHook({
      processDirectory: projectDirectory,
      stdinPayload: invocationPayload({
        filePath: "H:/Documents/Obsidian Vault/Context/note.md",
        cwd: projectDirectory,
      }),
    });
    expect(outcome).toMatchObject({ exitCode: 0, stderr: "" });
  });

  test("allows a nonmatching path under configured policy", async () => {
    const projectDirectory = configuredProjectDirectory({
      pathMarker: "Fixture/Private Notes",
    });
    const outcome = await runHook({
      processDirectory: projectDirectory,
      stdinPayload: invocationPayload({
        filePath: "/home/fixture/public/note.md",
        cwd: projectDirectory,
      }),
    });
    expect(outcome).toMatchObject({ exitCode: 0, stderr: "" });
  });

  test("refuses malformed existing configuration", async () => {
    const projectDirectory = createProjectDirectory({ contents: "{" });
    const outcome = await runHook({
      processDirectory: projectDirectory,
      stdinPayload: invocationPayload({
        filePath: "/home/fixture/note.md",
        cwd: projectDirectory,
      }),
    });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toBe(
      "Blocked: vault write policy configuration-malformed.",
    );
  });

  test("does not apply the write policy to non-editing tools", async () => {
    const projectDirectory = createProjectDirectory({ contents: "{" });
    const outcome = await runHook({
      processDirectory: projectDirectory,
      stdinPayload: invocationPayload({
        toolName: "Bash",
        filePath: "/home/fixture/private/note.md",
        cwd: projectDirectory,
      }),
    });
    expect(outcome).toMatchObject({ exitCode: 0, stderr: "" });
  });

  test.each([
    "",
    "{",
    "null",
    JSON.stringify({ [toolNameWireField]: "Write" }),
  ])("preserves neutral malformed invocation handling for %j", async (stdinPayload) => {
    const outcome = await runHook({
      processDirectory: createProjectDirectory({ contents: "{" }),
      stdinPayload,
    });
    expect(outcome).toMatchObject({ exitCode: 0, stderr: "" });
  });
});

describe("hook invocation boundary", () => {
  test("maps provider wire names into the plain hook input", () => {
    expect(
      parseHookInvocation({
        raw: JSON.stringify({
          [toolNameWireField]: "NotebookEdit",
          [toolInputWireField]: { [filePathWireField]: "/notes/a.ipynb" },
          cwd: "/consumer",
          providerField: "preserved outside this guard boundary",
        }),
      }),
    ).toEqual({
      toolName: "NotebookEdit",
      filePath: "/notes/a.ipynb",
      cwd: "/consumer",
    });
  });
});

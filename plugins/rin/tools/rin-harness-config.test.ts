import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect } from "node:util";
import { afterEach, describe, expect, test } from "vitest";
import {
  CONFIG_FILENAME,
  createDefaultVaultConfigurationReader,
  defaultProjectIdentity,
  type ProjectIdentityConfig,
  readConfig,
  readVaultPolicy,
  resolveProjectIdentity,
  validateProjectIdentity,
} from "./rin-harness-config.ts";

const createdRoots: string[] = [];

const createProjectDir = ({
  contents,
}: {
  readonly contents: string | null;
}): string => {
  const root = mkdtempSync(join(tmpdir(), "harness-config-"));
  createdRoots.push(root);
  if (contents !== null) {
    writeFileSync(join(root, CONFIG_FILENAME), contents, "utf-8");
  }
  return root;
};

afterEach(() => {
  createdRoots.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true });
  });
});

const configuredReviewCommand = {
  executable: "pnpm",
  commandArguments: ["gh:review"],
};

const distinctIdentity = {
  operator: "Ada",
  authorIdentity: "ada-author",
  reviewerIdentity: "ada-reviewer",
  deployTarget: "the cluster",
  backlogStore: "ada-tasks",
  mergeCommand: "make merge",
  reviewCommand: configuredReviewCommand,
  prCommand: "make pr",
  deployCommand: "make deploy",
};

const commandFields: readonly (keyof ProjectIdentityConfig)[] = [
  "mergeCommand",
  "prCommand",
  "deployCommand",
];

describe("validateProjectIdentity", () => {
  test("accepts a fully specified identity whose two GitHub roles differ", () => {
    expect(
      validateProjectIdentity({
        container: { projectIdentity: distinctIdentity },
      }),
    ).toStrictEqual({
      ok: true,
      value: {
        ...distinctIdentity,
        reviewCommand: {
          kind: "configured",
          binding: configuredReviewCommand,
        },
      },
    });
  });

  test("falls back to the neutral default when no projectIdentity is present", () => {
    expect(validateProjectIdentity({ container: {} })).toStrictEqual({
      ok: true,
      value: defaultProjectIdentity,
    });
  });

  test("rejects an identity whose author and reviewer are the same actor", () => {
    const result = validateProjectIdentity({
      container: {
        projectIdentity: {
          ...distinctIdentity,
          reviewerIdentity: distinctIdentity.authorIdentity,
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false ? result.error : "").toContain("must differ");
  });

  test("names the self-review consequence rather than reporting a bare mismatch", () => {
    const result = validateProjectIdentity({
      container: {
        projectIdentity: {
          ...distinctIdentity,
          reviewerIdentity: distinctIdentity.authorIdentity,
        },
      },
    });
    expect(result.ok === false ? result.error : "").toContain(
      "reviewing its own pull request",
    );
  });

  test.each<keyof typeof distinctIdentity>([
    "operator",
    "authorIdentity",
    "reviewerIdentity",
    "deployTarget",
    "backlogStore",
    "mergeCommand",
    "prCommand",
    "deployCommand",
  ])("rejects an identity missing the required %s field", (field) => {
    const { [field]: _omitted, ...withoutField } = distinctIdentity;
    expect(
      validateProjectIdentity({ container: { projectIdentity: withoutField } })
        .ok,
    ).toBe(false);
  });

  test("rejects a projectIdentity that is not an object", () => {
    expect(
      validateProjectIdentity({ container: { projectIdentity: "Ada" } }).ok,
    ).toBe(false);
  });
});

describe("resolveProjectIdentity", () => {
  test("resolves the configured identity when the file is present and valid", () => {
    const projectDir = createProjectDir({
      contents: JSON.stringify({
        projectName: "ada",
        defaultScope: "workshop",
        rulesetRoot: "aidlc/spaces/default/memory",
        stageGraph: ".claude/tools/data/stage-graph.json",
        packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
        projectIdentity: distinctIdentity,
      }),
    });
    expect(resolveProjectIdentity({ projectDir })).toStrictEqual({
      kind: "resolved",
      projectIdentity: {
        ...distinctIdentity,
        reviewCommand: {
          kind: "configured",
          binding: configuredReviewCommand,
        },
      },
    });
  });

  test("reports missing-file when no config file exists", () => {
    const projectDir = createProjectDir({ contents: null });
    const outcome = resolveProjectIdentity({ projectDir });
    expect(outcome.kind).toBe("unresolved");
    expect(outcome.kind === "unresolved" ? outcome.reason.kind : "").toBe(
      "missing-file",
    );
  });

  test("reports parse-failure when the config file is not valid JSON", () => {
    const projectDir = createProjectDir({ contents: "{ not json at all" });
    const outcome = resolveProjectIdentity({ projectDir });
    expect(outcome.kind === "unresolved" ? outcome.reason.kind : "").toBe(
      "parse-failure",
    );
  });

  test("reports validation-failure when the two identities are the same actor", () => {
    const projectDir = createProjectDir({
      contents: JSON.stringify({
        projectName: "ada",
        defaultScope: "workshop",
        rulesetRoot: "aidlc/spaces/default/memory",
        stageGraph: ".claude/tools/data/stage-graph.json",
        packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
        projectIdentity: {
          ...distinctIdentity,
          reviewerIdentity: distinctIdentity.authorIdentity,
        },
      }),
    });
    const outcome = resolveProjectIdentity({ projectDir });
    expect(outcome.kind === "unresolved" ? outcome.reason.kind : "").toBe(
      "validation-failure",
    );
  });

  test("carries the self-review consequence in the validation-failure detail", () => {
    const projectDir = createProjectDir({
      contents: JSON.stringify({
        projectName: "ada",
        defaultScope: "workshop",
        rulesetRoot: "aidlc/spaces/default/memory",
        stageGraph: ".claude/tools/data/stage-graph.json",
        packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
        projectIdentity: {
          ...distinctIdentity,
          reviewerIdentity: distinctIdentity.authorIdentity,
        },
      }),
    });
    const outcome = resolveProjectIdentity({ projectDir });
    expect(
      outcome.kind === "unresolved" &&
        outcome.reason.kind === "validation-failure"
        ? outcome.reason.detail
        : "",
    ).toContain("reviewing its own pull request");
  });
});

describe("review command binding", () => {
  test("resolves a configured literal executable and argument vector", () => {
    const projectDir = createProjectDir({
      contents: JSON.stringify({
        projectName: "ada",
        defaultScope: "workshop",
        rulesetRoot: "aidlc/spaces/default/memory",
        stageGraph: ".claude/tools/data/stage-graph.json",
        packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
        projectIdentity: {
          ...distinctIdentity,
          reviewCommand: configuredReviewCommand,
        },
      }),
    });

    expect(readConfig({ projectDir })).toMatchObject({
      source: "file",
      failure: null,
      config: {
        projectIdentity: {
          reviewCommand: {
            kind: "configured",
            binding: {
              executable: "pnpm",
              commandArguments: ["gh:review"],
            },
          },
        },
      },
    });
  });

  test("preserves shell metacharacters as literal arguments", () => {
    const commandArguments = ["gh:review", "$HOME", "&&", "*.md"];
    const projectDir = createProjectDir({
      contents: JSON.stringify({
        projectName: "ada",
        defaultScope: "workshop",
        rulesetRoot: "aidlc/spaces/default/memory",
        stageGraph: ".claude/tools/data/stage-graph.json",
        packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
        projectIdentity: {
          ...distinctIdentity,
          reviewCommand: { executable: "pnpm", commandArguments },
        },
      }),
    });

    expect(
      readConfig({ projectDir }).config.projectIdentity.reviewCommand,
    ).toStrictEqual({
      kind: "configured",
      binding: { executable: "pnpm", commandArguments },
    });
  });

  test("resolves an omitted review command as unconfigured without discarding the consumer config", () => {
    const {
      reviewCommand: _reviewCommand,
      ...projectIdentityWithoutReviewCommand
    } = distinctIdentity;
    const projectDir = createProjectDir({
      contents: JSON.stringify({
        projectName: "ada",
        defaultScope: "workshop",
        rulesetRoot: "aidlc/spaces/default/memory",
        stageGraph: ".claude/tools/data/stage-graph.json",
        packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
        projectIdentity: projectIdentityWithoutReviewCommand,
      }),
    });

    expect(readConfig({ projectDir })).toMatchObject({
      source: "file",
      failure: null,
      config: {
        projectIdentity: {
          reviewCommand: { kind: "unconfigured" },
        },
      },
    });
  });

  test.each([
    "pnpm gh:review",
    null,
    { executable: "   ", commandArguments: ["gh:review"] },
    { executable: "pnpm", commandArguments: ["gh:review", 1] },
    { executable: "pnpm", commandArguments: ["gh:review"], shell: true },
  ])("refuses malformed present review command bindings", (reviewCommand) => {
    const projectDir = createProjectDir({
      contents: JSON.stringify({
        projectName: "ada",
        defaultScope: "workshop",
        rulesetRoot: "aidlc/spaces/default/memory",
        stageGraph: ".claude/tools/data/stage-graph.json",
        packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
        projectIdentity: { ...distinctIdentity, reviewCommand },
      }),
    });

    expect(readConfig({ projectDir })).toMatchObject({
      source: "defaults",
      failure: { kind: "validation-failure", field: "reviewCommand" },
    });
  });
});

describe("defaultProjectIdentity", () => {
  test.each(
    commandFields,
  )("states the contract an adopter must satisfy for %s", (field) => {
    expect(defaultProjectIdentity[field]).toContain("unconfigured");
  });

  test("names the approved-verdict precondition on the merge command", () => {
    expect(defaultProjectIdentity.mergeCommand).toContain("APPROVED");
  });

  test("defaults the review command to unconfigured", () => {
    expect(defaultProjectIdentity.reviewCommand).toStrictEqual({
      kind: "unconfigured",
    });
  });

  test("names the idempotence precondition on the deploy command", () => {
    expect(defaultProjectIdentity.deployCommand).toContain("idempotent");
  });

  test("names the branch the pull-request command acts on", () => {
    expect(defaultProjectIdentity.prCommand).toContain("current branch");
  });

  test("carries an author and reviewer identity that already differ", () => {
    expect(defaultProjectIdentity.authorIdentity).not.toBe(
      defaultProjectIdentity.reviewerIdentity,
    );
  });
});

describe("consumer vault configuration", () => {
  test("omitted vault policy remains neutral", () => {
    const projectDir = createProjectDir({ contents: null });
    expect(readConfig({ projectDir }).config.mechanisms).toMatchObject({
      vaultWritePolicy: { adapter: "unconfigured" },
    });
  });

  test("exposes a configured marker only through redacted policy data", () => {
    const projectDir = createProjectDir({
      contents: JSON.stringify({
        projectName: "fixture",
        defaultScope: "workshop",
        rulesetRoot: "memory",
        stageGraph: "graph.json",
        packageManager: { primary: "bun", runnerAllowlist: [] },
        mechanisms: {
          vaultWritePolicy: {
            adapter: "mcp-only",
            pathMarker: "Fixture/Private Notes",
          },
        },
      }),
    });
    const loaded = readConfig({ projectDir });
    expect(loaded.failure).toBeNull();
    expect(JSON.parse(JSON.stringify(loaded.config.mechanisms))).toMatchObject({
      vaultWritePolicy: { adapter: "mcp-only", pathMarker: "[REDACTED]" },
    });
  });

  test.each([
    null,
    { adapter: "mcp-only", pathMarker: " " },
    { adapter: "mcp-only", pathMarker: "segment//gap" },
    { adapter: "other" },
  ])("refuses malformed supplied vault policy", (vaultWritePolicy) => {
    const projectDir = createProjectDir({
      contents: JSON.stringify({
        projectName: "fixture",
        defaultScope: "workshop",
        rulesetRoot: "memory",
        stageGraph: "graph.json",
        packageManager: { primary: "bun", runnerAllowlist: [] },
        mechanisms: { vaultWritePolicy },
      }),
    });
    expect(readConfig({ projectDir }).failure).toMatchObject({
      kind: "validation-failure",
      field: "vaultWritePolicy",
    });
  });

  test("distinguishes an unreadable existing config from malformed JSON", () => {
    const unreadableRoot = createProjectDir({ contents: null });
    mkdirSync(join(unreadableRoot, CONFIG_FILENAME));
    const malformedRoot = createProjectDir({ contents: "{" });
    expect(readConfig({ projectDir: unreadableRoot }).failure).toMatchObject({
      kind: "parse-failure",
      failurePhase: "read",
    });
    expect(readConfig({ projectDir: malformedRoot }).failure).toMatchObject({
      kind: "parse-failure",
      failurePhase: "parse",
    });
  });
});

describe("vault policy privacy and consumer reads", () => {
  test.each([
    "Fixture/Private Notes",
    "Another\\Protected Space",
  ])("matches only the configured literal path segments", (pathMarker) => {
    const projectDir = createProjectDir({
      contents: JSON.stringify({
        projectName: "fixture",
        defaultScope: "workshop",
        rulesetRoot: "memory",
        stageGraph: "graph.json",
        packageManager: { primary: "bun", runnerAllowlist: [] },
        mechanisms: { vaultWritePolicy: { adapter: "mcp-only", pathMarker } },
      }),
    });
    const loaded = readConfig({ projectDir });
    const policy = loaded.config.mechanisms.vaultWritePolicy;
    expect(policy.adapter).toBe("mcp-only");
    if (policy.adapter !== "mcp-only")
      throw new Error("Expected configured fixture policy");
    expect(
      policy.pathMarker.classifyPath({
        candidatePath: `/home/${pathMarker.toUpperCase()}/note.md`,
      }),
    ).toBe("vault-path");
    expect(
      policy.pathMarker.classifyPath({
        candidatePath: `/home/prefix${pathMarker}/note.md`,
      }),
    ).toBe("outside-vault");
    expect(
      policy.pathMarker.classifyPath({
        candidatePath: `/home/${pathMarker}suffix/note.md`,
      }),
    ).toBe("outside-vault");
    expect(
      policy.pathMarker.classifyPath({
        candidatePath: "/home/unrelated/note.md",
      }),
    ).toBe("outside-vault");
    [
      JSON.stringify(loaded),
      inspect(loaded),
      String(policy.pathMarker),
      inspect({ ...policy.pathMarker }),
    ].forEach((rendered) => {
      expect(rendered).not.toContain(pathMarker);
    });
  });

  test("an unreadable consumer refuses policy resolution", () => {
    const projectDir = createProjectDir({ contents: null });
    mkdirSync(join(projectDir, CONFIG_FILENAME));
    expect(
      readVaultPolicy({
        projectDir,
        reader: createDefaultVaultConfigurationReader(),
      }),
    ).toEqual({
      outcome: "failed",
      vaultPolicyReadFailure: { kind: "configuration-unreadable" },
    });
  });

  test("invalid submitted markers never appear in diagnostics", () => {
    const pathMarker = "Private Fixture//Rejected Secret";
    const projectDir = createProjectDir({
      contents: JSON.stringify({
        projectName: "fixture",
        defaultScope: "workshop",
        rulesetRoot: "memory",
        stageGraph: "graph.json",
        packageManager: { primary: "bun", runnerAllowlist: [] },
        mechanisms: { vaultWritePolicy: { adapter: "mcp-only", pathMarker } },
      }),
    });
    const loaded = readConfig({ projectDir });
    expect(loaded.failure).toMatchObject({
      kind: "validation-failure",
      field: "vaultWritePolicy",
    });
    expect(JSON.stringify(loaded)).not.toContain(pathMarker);
    expect(inspect(loaded)).not.toContain(pathMarker);
  });

  test.each([
    {
      contents: null,
      expected: {
        outcome: "resolved",
        vaultPolicy: { adapter: "unconfigured" },
      },
    },
    {
      contents: "{",
      expected: {
        outcome: "failed",
        vaultPolicyReadFailure: { kind: "configuration-malformed" },
      },
    },
    {
      contents: "{}",
      expected: {
        outcome: "failed",
        vaultPolicyReadFailure: {
          kind: "configuration-invalid",
          invalidConfigField: "projectName",
        },
      },
    },
  ])("reads the requested consumer exactly once", ({ contents, expected }) => {
    const projectDir = createProjectDir({ contents });
    const consumers: string[] = [];
    const reader = {
      readConfiguration: (consumer: { readonly projectDir: string }) => {
        consumers.push(consumer.projectDir);
        return readConfig(consumer);
      },
    };
    expect(readVaultPolicy({ projectDir, reader })).toEqual(expected);
    expect(consumers).toEqual([projectDir]);
    expect(
      readVaultPolicy({
        projectDir,
        reader: createDefaultVaultConfigurationReader(),
      }),
    ).toEqual(expected);
  });
});

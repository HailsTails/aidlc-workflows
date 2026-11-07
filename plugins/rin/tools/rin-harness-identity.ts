import type { IdentityConfig } from "./rin-harness-config.ts";
import { configIdentity, defaultMechanisms } from "./rin-harness-config.ts";

type CommitterIdentity = {
  readonly name: string;
  readonly email: string;
};

type IdentityProvider = {
  resolveCommitter(): CommitterIdentity;
};

const createWorkspaceDefaultIdentityAdapter = ({
  name,
  email,
}: {
  readonly name: string;
  readonly email: string;
}): IdentityProvider => ({
  resolveCommitter: () => ({ name, email }),
});

const createGitAuthorIdentityAdapter = ({
  name,
  email,
}: {
  readonly name: string;
  readonly email: string;
}): IdentityProvider => ({
  resolveCommitter: () => ({ name, email }),
});

const adapterFor = (identity: IdentityConfig): IdentityProvider => {
  if (identity.adapter === "git-author") {
    return createGitAuthorIdentityAdapter({
      name: identity.name,
      email: identity.email,
    });
  }
  return createWorkspaceDefaultIdentityAdapter({
    name: identity.name,
    email: identity.email,
  });
};

const createDefaultIdentityProvider = ({
  projectDir,
}: {
  readonly projectDir: string;
}): IdentityProvider => adapterFor(configIdentity({ projectDir }));

const resolveCommitterIdentity = ({
  projectDir,
}: {
  readonly projectDir: string;
}): CommitterIdentity =>
  createDefaultIdentityProvider({ projectDir }).resolveCommitter();

export type { CommitterIdentity, IdentityProvider };
export {
  createDefaultIdentityProvider,
  createGitAuthorIdentityAdapter,
  createWorkspaceDefaultIdentityAdapter,
  resolveCommitterIdentity,
};

const portSurface = {
  port: "IdentityProvider",
  capabilities: ["resolveCommitter"],
  domainType: { CommitterIdentity: ["name", "email"] },
  adapters: [
    {
      name: "workspace-default",
      factory: "createWorkspaceDefaultIdentityAdapter",
      status: "implemented",
    },
    {
      name: "git-author",
      factory: "createGitAuthorIdentityAdapter",
      status: "implemented",
    },
  ],
  defaultFactory: "createDefaultIdentityProvider",
} as const;

const invokedDirectly =
  process.argv[1]?.endsWith("rin-harness-identity.ts") ?? false;

if (invokedDirectly) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const command = process.argv[2] ?? "describe";
  if (command === "describe") {
    process.stdout.write(
      `${JSON.stringify(
        { ...portSurface, resolved: resolveCommitterIdentity({ projectDir }) },
        null,
        2,
      )}\n`,
    );
  } else if (command === "resolve") {
    const identity = resolveCommitterIdentity({ projectDir });
    process.stdout.write(`${identity.name} <${identity.email}>\n`);
  } else {
    process.stderr.write(
      `rin-harness-identity: unknown command "${command}" (describe|resolve) — default ${defaultMechanisms.identity.adapter}\n`,
    );
    process.exit(1);
  }
}

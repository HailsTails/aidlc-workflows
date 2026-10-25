import { z } from "zod";
import type {
  CredentialFailure,
  CredentialStorePort,
  RoleCredentials,
} from "../application/credential-store-port.ts";
import type { AgentRole } from "../domain/agent-role.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import { parseJsonText } from "./json-text.ts";
import type { TextFileReader } from "./text-file-reader.ts";
import type { UserEnvironment } from "./user-environment.ts";

const CREDENTIALS_FILE_NAME = "credentials.json";

const STORE_DIRECTORY_VARIABLE = "RIN_GITHUB_APPS_CREDENTIALS_DIR";

const STORE_PATH_IN_HOME = ".config/rin-github-apps";

const roleEntrySchema = z.object({
  appId: z.union([z.string().regex(/^\d+$/), z.number().int().positive().transform(String)]),
  privateKeyPath: z.string().min(1),
});

const credentialsFileSchema = z.object({
  author: roleEntrySchema.optional(),
  reviewer: roleEntrySchema.optional(),
});

type CredentialsFile = z.infer<typeof credentialsFileSchema>;

type StoreLocator = () => Result<string, { readonly detail: string }>;

type FileCredentialStoreDependencies = {
  readonly locateStoreDirectory: StoreLocator;
  readonly readTextFile: TextFileReader;
};

type UserStore = { readonly environment: UserEnvironment };

type KeyLocation = { readonly storeDirectory: string; readonly privateKeyPath: string };

type RoleLookup = FileCredentialStoreDependencies & {
  readonly role: AgentRole;
  readonly storeDirectory: string;
};

const resolveKeyPath = ({ storeDirectory, privateKeyPath }: KeyLocation): string =>
  /^(?:[A-Za-z]:)?[\\/]/.test(privateKeyPath)
    ? privateKeyPath
    : `${storeDirectory}/${privateKeyPath}`;

const readCredentialsFile = async ({
  readTextFile,
  storeDirectory,
}: RoleLookup): Promise<Result<CredentialsFile, CredentialFailure>> => {
  const credentialsPath = `${storeDirectory}/${CREDENTIALS_FILE_NAME}`;
  const credentialsText = await readTextFile(credentialsPath);
  if (credentialsText.kind === "failure") {
    return fail({ kind: "credentials-unreadable", path: credentialsPath });
  }
  const credentialsJson = parseJsonText(credentialsText.outcome);
  if (credentialsJson.kind === "failure") {
    return fail({ kind: "credentials-invalid", path: credentialsPath, issues: "not JSON" });
  }
  const parsed = credentialsFileSchema.safeParse(credentialsJson.outcome);
  if (!parsed.success) {
    return fail({
      kind: "credentials-invalid",
      path: credentialsPath,
      issues: parsed.error.message,
    });
  }
  return succeed(parsed.data);
};

const loadFromStore = async (
  lookup: RoleLookup,
): Promise<Result<RoleCredentials, CredentialFailure>> => {
  const { role, storeDirectory, readTextFile } = lookup;
  const credentialsFile = await readCredentialsFile(lookup);
  if (credentialsFile.kind === "failure") return credentialsFile;
  const roleEntry = credentialsFile.outcome[role];
  if (roleEntry === undefined) {
    return fail({ kind: "role-credentials-missing", role, path: storeDirectory });
  }
  const keyPath = resolveKeyPath({ storeDirectory, privateKeyPath: roleEntry.privateKeyPath });
  const privateKeyPem = await readTextFile(keyPath);
  if (privateKeyPem.kind === "failure") {
    return fail({ kind: "private-key-unreadable", role, path: keyPath });
  }
  return succeed({ appId: roleEntry.appId, privateKey: secret(privateKeyPem.outcome) });
};

const withForwardSlashes = (path: string): string => path.replaceAll("\\", "/");

const locateUserStore =
  ({ environment }: UserStore): StoreLocator =>
  () => {
    const overriddenDirectory = environment.variable(STORE_DIRECTORY_VARIABLE);
    if (overriddenDirectory !== undefined && overriddenDirectory.length > 0) {
      return succeed(withForwardSlashes(overriddenDirectory));
    }
    const homeDirectory = environment.homeDirectory();
    if (homeDirectory.length === 0) {
      return fail({ detail: `no home directory, and ${STORE_DIRECTORY_VARIABLE} is unset` });
    }
    return succeed(`${withForwardSlashes(homeDirectory)}/${STORE_PATH_IN_HOME}`);
  };

const createFileCredentialStore = (
  dependencies: FileCredentialStoreDependencies,
): CredentialStorePort => ({
  loadRoleCredentials: async ({ role }) => {
    const storeDirectory = dependencies.locateStoreDirectory();
    if (storeDirectory.kind === "failure") {
      return fail({ kind: "credential-store-unlocatable", detail: storeDirectory.reason.detail });
    }
    return loadFromStore({ ...dependencies, role, storeDirectory: storeDirectory.outcome });
  },
});

export { createFileCredentialStore, locateUserStore, type StoreLocator };

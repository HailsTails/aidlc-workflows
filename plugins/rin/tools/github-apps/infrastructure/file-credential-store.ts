import { z } from "zod";
import type {
  CredentialFailure,
  CredentialStorePort,
  RoleCredentials,
  StoreLocator,
  UserAuthorisationSettingsPort,
} from "../application/credential-store-port.ts";
import type { TextFileReader } from "../application/text-file-port.ts";
import type { AgentRole } from "../domain/agent-role.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import { parseJsonText } from "./json-text.ts";
import type { UserEnvironment } from "./user-environment.ts";

const CREDENTIALS_FILE_NAME = "credentials.json";

const STORE_DIRECTORY_VARIABLE = "RIN_GITHUB_APPS_CREDENTIALS_DIR";

const STORE_PATH_IN_HOME = ".config/rin-github-apps";

const roleEntrySchema = z.object({
  appId: z.union([z.string().regex(/^\d+$/), z.number().int().positive().transform(String)]),
  privateKeyPath: z.string().min(1),
  userAuthorisation: z.object({ clientId: z.string().min(1) }).optional(),
});

const credentialsFileSchema = z.object({
  author: roleEntrySchema.optional(),
  reviewer: roleEntrySchema.optional(),
});

type CredentialsFile = z.infer<typeof credentialsFileSchema>;

type RoleEntry = z.infer<typeof roleEntrySchema>;

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

type RoleRequest = FileCredentialStoreDependencies & { readonly role: AgentRole };

type LocatedRoleEntry = { readonly roleEntry: RoleEntry; readonly storeDirectory: string };

const isAbsolutePath = (path: string): boolean => /^(?:[A-Za-z]:)?[\\/]/.test(path);

const resolveKeyPath = ({ storeDirectory, privateKeyPath }: KeyLocation): string =>
  isAbsolutePath(privateKeyPath) ? privateKeyPath : `${storeDirectory}/${privateKeyPath}`;

const credentialsPathIn = (storeDirectory: string): string =>
  `${storeDirectory}/${CREDENTIALS_FILE_NAME}`;

const readCredentialsFile = async ({
  readTextFile,
  storeDirectory,
}: RoleLookup): Promise<Result<CredentialsFile, CredentialFailure>> => {
  const credentialsPath = credentialsPathIn(storeDirectory);
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

const loadRoleEntry = async (
  request: RoleRequest,
): Promise<Result<LocatedRoleEntry, CredentialFailure>> => {
  const { role, locateStoreDirectory } = request;
  const storeDirectory = locateStoreDirectory();
  if (storeDirectory.kind === "failure") {
    return fail({ kind: "credential-store-unlocatable", detail: storeDirectory.reason.detail });
  }
  const credentialsFile = await readCredentialsFile({
    ...request,
    storeDirectory: storeDirectory.outcome,
  });
  if (credentialsFile.kind === "failure") return credentialsFile;
  const roleEntry = credentialsFile.outcome[role];
  if (roleEntry === undefined) {
    return fail({ kind: "role-credentials-missing", role, path: storeDirectory.outcome });
  }
  return succeed({ roleEntry, storeDirectory: storeDirectory.outcome });
};

const loadRoleCredentials = async (
  request: RoleRequest,
): Promise<Result<RoleCredentials, CredentialFailure>> => {
  const located = await loadRoleEntry(request);
  if (located.kind === "failure") return located;
  const { roleEntry, storeDirectory } = located.outcome;
  const keyPath = resolveKeyPath({ storeDirectory, privateKeyPath: roleEntry.privateKeyPath });
  const privateKeyPem = await request.readTextFile(keyPath);
  if (privateKeyPem.kind === "failure") {
    return fail({ kind: "private-key-unreadable", role: request.role, path: keyPath });
  }
  return succeed({ appId: roleEntry.appId, privateKey: secret(privateKeyPem.outcome) });
};

const withForwardSlashes = (path: string): string => path.replaceAll("\\", "/");

const locateUserStore =
  ({ environment }: UserStore): StoreLocator =>
  () => {
    const overriddenDirectory = environment.variable(STORE_DIRECTORY_VARIABLE);
    if (overriddenDirectory !== undefined && overriddenDirectory.length > 0) {
      if (!isAbsolutePath(overriddenDirectory)) {
        return fail({
          detail: `${STORE_DIRECTORY_VARIABLE} must be an absolute path, not "${overriddenDirectory}"`,
        });
      }
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
): CredentialStorePort & UserAuthorisationSettingsPort => ({
  loadRoleCredentials: ({ role }) => loadRoleCredentials({ ...dependencies, role }),
  loadUserAuthorisationSettings: async ({ role }) => {
    const located = await loadRoleEntry({ ...dependencies, role });
    if (located.kind === "failure") return located;
    const { roleEntry, storeDirectory } = located.outcome;
    if (roleEntry.userAuthorisation === undefined) {
      return fail({
        kind: "user-authorisation-unconfigured",
        role,
        path: credentialsPathIn(storeDirectory),
      });
    }
    return succeed({ clientId: roleEntry.userAuthorisation.clientId });
  },
});

export { createFileCredentialStore, locateUserStore };

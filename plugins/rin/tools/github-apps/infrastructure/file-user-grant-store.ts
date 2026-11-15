import { z } from "zod";
import type { StoreLocator } from "../application/credential-store-port.ts";
import type { ExclusiveLockPort } from "../application/exclusive-lock-port.ts";
import type { PausePort } from "../application/pause-port.ts";
import type {
  FileUnwritable,
  PrivateFileReplacer,
  PrivateFileWrite,
} from "../application/private-file-port.ts";
import type { TextFileReader } from "../application/text-file-port.ts";
import type {
  GrantStoreUnlocatable,
  UserGrantStorePort,
} from "../application/user-grant-store-port.ts";
import type { AgentRole } from "../domain/agent-role.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import type { UserGrant } from "../domain/user-grant.ts";
import { parseJsonText } from "./json-text.ts";

const GRANT_FILE_SUFFIX = ".user-grant.json";

const LOCK_FILE_SUFFIX = ".user-grant.lock";

const JSON_INDENTATION = 2;

const SAVE_ATTEMPTS = 5;

const SAVE_RETRY_MILLISECONDS = 50;

const storedGrantSchema = z.strictObject({
  accessToken: z.string().min(1),
  accessTokenExpiresAtEpochSeconds: z.number().int().positive(),
  refreshToken: z.string().min(1),
  refreshTokenExpiresAtEpochSeconds: z.number().int().positive(),
});

type StoredGrant = z.infer<typeof storedGrantSchema>;

type FileUserGrantStoreDependencies = {
  readonly locateStoreDirectory: StoreLocator;
  readonly readTextFile: TextFileReader;
  readonly replacePrivateFile: PrivateFileReplacer;
  readonly lock: ExclusiveLockPort;
  readonly pause: PausePort;
};

type PersistentReplace = Pick<FileUserGrantStoreDependencies, "replacePrivateFile" | "pause"> & {
  readonly write: PrivateFileWrite;
  readonly attemptsLeft: number;
};

type StoreFile = {
  readonly locateStoreDirectory: StoreLocator;
  readonly role: AgentRole;
  readonly suffix: string;
};

const locateStoreFile = ({
  locateStoreDirectory,
  role,
  suffix,
}: StoreFile): Result<string, GrantStoreUnlocatable> => {
  const storeDirectory = locateStoreDirectory();
  if (storeDirectory.kind === "failure") {
    return fail({ kind: "credential-store-unlocatable", detail: storeDirectory.reason.detail });
  }
  return succeed(`${storeDirectory.outcome}/${role}${suffix}`);
};

const grantFromStored = (stored: StoredGrant): UserGrant => ({
  accessToken: secret(stored.accessToken),
  accessTokenExpiresAtEpochSeconds: stored.accessTokenExpiresAtEpochSeconds,
  refreshToken: secret(stored.refreshToken),
  refreshTokenExpiresAtEpochSeconds: stored.refreshTokenExpiresAtEpochSeconds,
});

const storedFromGrant = (grant: UserGrant): StoredGrant => ({
  accessToken: grant.accessToken.reveal(),
  accessTokenExpiresAtEpochSeconds: grant.accessTokenExpiresAtEpochSeconds,
  refreshToken: grant.refreshToken.reveal(),
  refreshTokenExpiresAtEpochSeconds: grant.refreshTokenExpiresAtEpochSeconds,
});

const grantFileText = (grant: UserGrant): string =>
  `${JSON.stringify(storedFromGrant(grant), null, JSON_INDENTATION)}\n`;

const replacePersistently = async (
  replace: PersistentReplace,
): Promise<Result<void, FileUnwritable>> => {
  const { replacePrivateFile, pause, write, attemptsLeft } = replace;
  const replaced = await replacePrivateFile(write);
  if (replaced.kind === "success" || attemptsLeft === 1) return replaced;
  await pause.pauseMilliseconds(SAVE_RETRY_MILLISECONDS);
  return replacePersistently({ ...replace, attemptsLeft: attemptsLeft - 1 });
};

const createFileUserGrantStore = ({
  locateStoreDirectory,
  readTextFile,
  replacePrivateFile,
  lock,
  pause,
}: FileUserGrantStoreDependencies): UserGrantStorePort => ({
  load: async ({ role }) => {
    const grantPath = locateStoreFile({ locateStoreDirectory, role, suffix: GRANT_FILE_SUFFIX });
    if (grantPath.kind === "failure") return grantPath;
    const path = grantPath.outcome;
    const grantText = await readTextFile(path);
    if (grantText.kind === "failure") return fail({ kind: "user-grant-missing", path });
    const grantJson = parseJsonText(grantText.outcome);
    if (grantJson.kind === "failure") {
      return fail({ kind: "user-grant-invalid", path, issues: "not JSON" });
    }
    const parsed = storedGrantSchema.safeParse(grantJson.outcome);
    if (!parsed.success) {
      return fail({ kind: "user-grant-invalid", path, issues: parsed.error.message });
    }
    return succeed(grantFromStored(parsed.data));
  },
  save: async ({ role, grant }) => {
    const grantPath = locateStoreFile({ locateStoreDirectory, role, suffix: GRANT_FILE_SUFFIX });
    if (grantPath.kind === "failure") return grantPath;
    const path = grantPath.outcome;
    const replaced = await replacePersistently({
      replacePrivateFile,
      pause,
      write: { location: path, text: grantFileText(grant) },
      attemptsLeft: SAVE_ATTEMPTS,
    });
    if (replaced.kind === "failure") {
      return fail({ kind: "user-grant-unwritable", path, detail: replaced.reason.detail });
    }
    return succeed(undefined);
  },
  lock: async ({ role }) => {
    const lockPath = locateStoreFile({ locateStoreDirectory, role, suffix: LOCK_FILE_SUFFIX });
    if (lockPath.kind === "failure") return lockPath;
    const acquired = await lock.acquire(lockPath.outcome);
    if (acquired.kind === "success") return acquired;
    const { reason } = acquired;
    return reason.kind === "lock-unwritable"
      ? fail({ kind: "user-grant-lock-unwritable", path: reason.lockLocation, detail: reason.detail })
      : fail({ kind: "user-grant-lock-unavailable", path: reason.lockLocation });
  },
});

export { createFileUserGrantStore };

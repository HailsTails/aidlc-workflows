import { readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import type {
  FileMover,
  FileRemover,
  PrivateFileCreator,
  PrivateFileReplacer,
} from "../application/private-file-port.ts";
import type { CanonicalPathResolver, TextFileReader } from "../application/text-file-port.ts";
import { fail, succeed } from "../domain/result.ts";

const OWNER_ONLY_MODE = 0o600;

const CREATE_EXCLUSIVELY = "wx";

const ALREADY_EXISTS_CODE = "EEXIST";

const NOT_FOUND_CODE = "ENOENT";

const ownerOnlyCreation = { flag: CREATE_EXCLUSIVELY, mode: OWNER_ONLY_MODE } as const;

const hasErrorCode = (caught: unknown): caught is { readonly code: string } =>
  typeof caught === "object" &&
  caught !== null &&
  "code" in caught &&
  typeof caught.code === "string";

const isErrorCoded = ({ caught, code }: { readonly caught: unknown; readonly code: string }) =>
  hasErrorCode(caught) && caught.code === code;

const describeFailure = (caught: unknown): string =>
  caught instanceof Error ? caught.message : String(caught);

const temporarySiblingOf = (location: string): string =>
  `${location}.${process.pid}.${globalThis.crypto.randomUUID()}.tmp`;

const readTextFile: TextFileReader = async (location) => {
  try {
    return succeed(await readFile(location, "utf8"));
  } catch {
    return fail({ kind: "file-unreadable", location: String(location) });
  }
};

const resolveCanonicalPath: CanonicalPathResolver = async (location) => {
  try {
    return succeed(await realpath(location));
  } catch {
    return fail({ kind: "file-unreadable", location });
  }
};

const discardTemporary = async (temporaryLocation: string): Promise<void> => {
  try {
    await rm(temporaryLocation, { force: true });
  } catch {
    return;
  }
};

const replacePrivateFile: PrivateFileReplacer = async ({ location, text }) => {
  const temporaryLocation = temporarySiblingOf(location);
  try {
    await writeFile(temporaryLocation, text, ownerOnlyCreation);
    await rename(temporaryLocation, location);
    return succeed(undefined);
  } catch (caught) {
    await discardTemporary(temporaryLocation);
    return fail({ kind: "file-unwritable", location, detail: describeFailure(caught) });
  }
};

const createPrivateFile: PrivateFileCreator = async ({ location, text }) => {
  try {
    await writeFile(location, text, ownerOnlyCreation);
    return succeed(undefined);
  } catch (caught) {
    if (isErrorCoded({ caught, code: ALREADY_EXISTS_CODE })) {
      return fail({ kind: "file-already-exists", location });
    }
    return fail({ kind: "file-unwritable", location, detail: describeFailure(caught) });
  }
};

const removeFile: FileRemover = async (location) => {
  try {
    await rm(location);
    return succeed(undefined);
  } catch (caught) {
    if (isErrorCoded({ caught, code: NOT_FOUND_CODE })) return succeed(undefined);
    return fail({ kind: "file-unwritable", location, detail: describeFailure(caught) });
  }
};

const moveFile: FileMover = async ({ from, to }) => {
  try {
    await rename(from, to);
    return succeed(undefined);
  } catch (caught) {
    if (isErrorCoded({ caught, code: NOT_FOUND_CODE })) {
      return fail({ kind: "file-missing", location: from });
    }
    return fail({ kind: "file-unwritable", location: from, detail: describeFailure(caught) });
  }
};

export {
  createPrivateFile,
  moveFile,
  readTextFile,
  removeFile,
  replacePrivateFile,
  resolveCanonicalPath,
};

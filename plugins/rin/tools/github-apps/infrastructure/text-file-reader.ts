import { readFile, realpath } from "node:fs/promises";
import type { CanonicalPathResolver, TextFileReader } from "../application/text-file-port.ts";
import { fail, succeed } from "../domain/result.ts";

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

export { readTextFile, resolveCanonicalPath };

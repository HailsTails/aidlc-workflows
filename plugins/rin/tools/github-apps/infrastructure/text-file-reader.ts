import { readFile } from "node:fs/promises";
import { fail, succeed, type Result } from "../domain/result.ts";

type FileUnreadable = { readonly kind: "file-unreadable"; readonly location: string };

type TextFileReader = (location: string | URL) => Promise<Result<string, FileUnreadable>>;

const readTextFile: TextFileReader = async (location) => {
  try {
    return succeed(await readFile(location, "utf8"));
  } catch {
    return fail({ kind: "file-unreadable", location: String(location) });
  }
};

export { readTextFile, type FileUnreadable, type TextFileReader };

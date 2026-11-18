import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HOST_FOLDERS = ["harness", "src/hosts"];

const REPOSITORY_ROOT = new URL("../", import.meta.url);

const foldersIn = (parent: string): readonly string[] => {
  const location = fileURLToPath(new URL(`${parent}/`, REPOSITORY_ROOT));
  return existsSync(location)
    ? readdirSync(location, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
};

export const HARNESS_FOLDER_NAMES: readonly string[] = [
  ...new Set(HOST_FOLDERS.flatMap(foldersIn)),
].toSorted((left, right) => left.localeCompare(right));

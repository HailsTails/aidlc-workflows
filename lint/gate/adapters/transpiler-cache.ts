import { mkdirSync } from "node:fs";
import { besideMainCheckout } from "./directory-lock.ts";

const CACHE_FOLDER = ".cache/bun-transpiler";

export const transpilerCacheFolder = (root: string): string => {
  const folder = besideMainCheckout(root, CACHE_FOLDER);
  mkdirSync(folder, { recursive: true });
  return folder;
};

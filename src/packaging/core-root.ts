import { readBuildVersion } from "./adapters/legacy-channel.ts";
import { createVersionStamp } from "./adapters/legacy-version.ts";
import { frameworkVersion } from "../kernel/values.ts";

export const createBuildPackaging = (readVersion = readBuildVersion) => {
  const captured = readVersion();
  return { version: captured.ok ? frameworkVersion(captured.value) : captured,
    stamp: createVersionStamp(captured) };
};

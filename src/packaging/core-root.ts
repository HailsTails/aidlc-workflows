import { readBuildVersion } from "./adapters/legacy-channel.ts";
import { createVersionStamp } from "./adapters/legacy-version.ts";

export const createBuildPackaging = (version = readBuildVersion) => ({ stamp: createVersionStamp(version()) });

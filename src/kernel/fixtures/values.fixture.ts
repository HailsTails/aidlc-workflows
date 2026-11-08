import {
  contentHash,
  distributionId,
  frameworkVersion,
  projectPath,
  sourcePath,
  timestamp,
  type ContentHash,
  type DistributionId,
  type FrameworkVersion,
  type ProjectPath,
  type SourcePath,
  type Timestamp,
} from "../values.ts";
import type { HostIdentity } from "../host.ts";
import { accept } from "./accept.ts";

export const path = (raw: string): ProjectPath => accept(projectPath(raw));

export const source = (raw: string): SourcePath => accept(sourcePath(raw));

export const distribution = (raw: string): DistributionId => accept(distributionId(raw));

export const hash = (raw: string): ContentHash => accept(contentHash(raw));

export const version = (raw: string): FrameworkVersion => accept(frameworkVersion(raw));

export const at = (raw: string): Timestamp => accept(timestamp(raw));

export const host = (name: string, directory: string): HostIdentity => ({
  distribution: distribution(name),
  directory: path(directory),
});

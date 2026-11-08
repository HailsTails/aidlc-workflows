import {
  contentHash,
  distributionId,
  frameworkVersion,
  relativePath,
  timestamp,
  type ContentHash,
  type DistributionId,
  type FrameworkVersion,
  type RelativePath,
  type Timestamp,
} from "../values.ts";
import { accept } from "./accept.ts";

export const path = (raw: string): RelativePath => accept(relativePath(raw));

export const distribution = (raw: string): DistributionId => accept(distributionId(raw));

export const hash = (raw: string): ContentHash => accept(contentHash(raw));

export const version = (raw: string): FrameworkVersion => accept(frameworkVersion(raw));

export const at = (raw: string): Timestamp => accept(timestamp(raw));

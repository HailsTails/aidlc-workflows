import { z } from "zod";
import { assembleCoreNative, copyRequestSchema, projectCoreCopy, projectCoreNative } from "./project-core.ts";
import type { ClaudeCopyRequest } from "./projection-process.ts";
const binding = { harness: "claude", directory: ".claude" } as const;
export const projectClaudeCopy = (request: ClaudeCopyRequest) => projectCoreCopy(request, binding);
export const assembleClaudeNative = (request: ClaudeCopyRequest) => assembleCoreNative(request, binding);
export const projectClaudeNative = (request: ClaudeCopyRequest) => projectCoreNative(request, binding);
if (import.meta.main) {
  const request = z.union([copyRequestSchema, copyRequestSchema.extend({ delivery: z.literal("native") })]).parse(await Bun.stdin.json());
  const profile = copyRequestSchema.parse({ sourceRoot: request.sourceRoot, outRoot: request.outRoot, buildVersion: request.buildVersion, environmentCap: request.environmentCap });
  console.log(JSON.stringify(await ("delivery" in request ? projectClaudeNative(profile) : projectClaudeCopy(profile))));
}

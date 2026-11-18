import { failedCases } from "./capability-exclusion.ts";

const BLOCK_LIMIT = 64 * 1024;
const bounded = (text: string): string => text.length <= BLOCK_LIMIT
  ? text
  : `[truncated; final ${BLOCK_LIMIT} characters retained]\n${text.slice(-BLOCK_LIMIT)}`;

export const failureOutput = (output: string): string => {
  const blocks: string[] = [];
  let pending: string[] = [];
  for (const line of output.split(/\r?\n/)) {
    if (/^\((pass|skip|todo)\) /.test(line)) {
      pending = [];
      continue;
    }
    pending.push(line);
    if (failedCases(line).length > 0) {
      blocks.push(bounded(pending.join("\n")));
      pending = [];
    }
  }
  if (blocks.length === 0) return bounded(output);
  const tail = pending.join("\n");
  if (/^error:/m.test(tail)) blocks.push(bounded(tail));
  return blocks.join("\n\n");
};

import { expect, test } from "bun:test";
import { channelTokens } from "./channel-tokens.ts";

test("the copy channel invokes the local tool tree", () => {
  expect(channelTokens({ channel: "copy", directory: ".scratch", prefix: "trusted", namespace: "route" }))
    .toEqual({ ["INVOKE"]: "bun .scratch/tools/aidlc.ts", ["TOOL_PREFIX"]: "bun .scratch/tools/",
      ["TRUSTED_NAMESPACE"]: "route" });
});

test("the native channel binds the installed command and trusted prefix", () => {
  expect(channelTokens({ channel: "native", directory: ".scratch", prefix: "trusted", namespace: "route" }))
    .toEqual({ ["INVOKE"]: "aidlc", ["TOOL_PREFIX"]: "trusted ", ["TRUSTED_NAMESPACE"]: "route" });
});
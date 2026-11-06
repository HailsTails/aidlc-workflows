import { expect, test } from "bun:test";
import { installCollisionHook } from "./collision-hook.ts";

test("invalid allocation refuses before accessing the fixture destination", async () => {
  await expect(installCollisionHook({ projectDir: "\0", messageId: "../escape" })).rejects.toThrow("Invalid fixture message ID");
});

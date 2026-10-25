import { describe, expect, it } from "vitest";
import { botIdentityFor } from "./bot-identity.ts";

describe("botIdentityFor", () => {
  it("names the bot actor and its noreply commit address after the app slug", () => {
    expect(botIdentityFor({ appSlug: "rin-author" })).toEqual({
      login: "rin-author[bot]",
      commitEmail: "rin-author[bot]@users.noreply.github.com",
    });
  });
});

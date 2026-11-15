import { describe, expect, it } from "vitest";
import { provenanceMarker, withProvenance } from "./provenance.ts";

describe("provenanceMarker", () => {
  it("emits the hidden comment that attributes a post to a role and session", () => {
    expect(provenanceMarker({ role: "reviewer", session: "pr-12", via: "installation" })).toBe(
      "<!-- rin-bot: role=reviewer session=pr-12 -->",
    );
  });
});

describe("provenanceMarker by credential", () => {
  it.each([
    ["installation", "<!-- rin-bot: role=author session=pr-12 -->"],
    ["user-grant", "<!-- rin-bot: role=author session=pr-12 via=user-grant -->"],
  ] as const)("marks a post written through %s", (via, marker) => {
    expect(provenanceMarker({ role: "author", session: "pr-12", via })).toBe(marker);
  });
});

describe("provenanceMarker with a branch-derived session", () => {
  it.each([
    ["feature/x-->injected", "<!-- rin-bot: role=author session=feature/x--_injected -->"],
    ["feature/x--!>injected", "<!-- rin-bot: role=author session=feature/x--__injected -->"],
    ["feature/<b>bold</b>", "<!-- rin-bot: role=author session=feature/_b_bold_/b_ -->"],
  ])("keeps %s inside the hidden comment", (session, marker) => {
    expect(provenanceMarker({ role: "author", session, via: "installation" })).toBe(marker);
  });
});

describe("withProvenance", () => {
  it.each([
    ["installation", "<!-- rin-bot: role=author session=feature/basket -->\n\nAdds the basket."],
    [
      "user-grant",
      "<!-- rin-bot: role=author session=feature/basket via=user-grant -->\n\nAdds the basket.",
    ],
  ] as const)("prefixes the authored body with the %s marker and a blank line", (via, text) => {
    expect(
      withProvenance({
        provenance: { role: "author", session: "feature/basket", via },
        authoredBody: "Adds the basket.",
      }),
    ).toBe(text);
  });
});

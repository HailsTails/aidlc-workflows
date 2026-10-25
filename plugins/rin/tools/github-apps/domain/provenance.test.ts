import { describe, expect, it } from "vitest";
import { provenanceMarker, withProvenance } from "./provenance.ts";

describe("provenanceMarker", () => {
  it("emits the hidden comment that attributes a post to a role and session", () => {
    expect(provenanceMarker({ role: "reviewer", session: "pr-12" })).toBe(
      "<!-- rin-bot: role=reviewer session=pr-12 -->",
    );
  });
});

describe("provenanceMarker with a branch-derived session", () => {
  it.each([
    ["feature/x-->injected", "<!-- rin-bot: role=author session=feature/x--_injected -->"],
    ["feature/x--!>injected", "<!-- rin-bot: role=author session=feature/x--__injected -->"],
    ["feature/<b>bold</b>", "<!-- rin-bot: role=author session=feature/_b_bold_/b_ -->"],
  ])("keeps %s inside the hidden comment", (session, marker) => {
    expect(provenanceMarker({ role: "author", session })).toBe(marker);
  });
});

describe("withProvenance", () => {
  it("prefixes the authored body with the marker and a blank line", () => {
    expect(
      withProvenance({
        provenance: { role: "author", session: "feature/basket" },
        authoredBody: "Adds the basket.",
      }),
    ).toBe("<!-- rin-bot: role=author session=feature/basket -->\n\nAdds the basket.");
  });
});

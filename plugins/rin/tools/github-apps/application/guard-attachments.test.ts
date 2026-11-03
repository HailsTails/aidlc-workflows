import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import type { StorePlacementCheck } from "./credential-store-boundary.ts";
import { guardAttachments } from "./guard-attachments.ts";

const outsideStore = { kind: "outside-store", canonicalPath: "H:/shop/a.png" } as const;

const insideStore = { kind: "inside-store" } as const;

describe("guardAttachments", () => {
  it("lets ordinary attachments through", async () => {
    const placeInStore = vi.fn<StorePlacementCheck>().mockResolvedValue(outsideStore);

    expect(await guardAttachments({ attachments: ["a.png"], placeInStore })).toEqual(succeed(undefined));
  });

  it("refuses a file inside the credential store", async () => {
    const placeInStore = vi
      .fn<StorePlacementCheck>()
      .mockResolvedValueOnce(outsideStore)
      .mockResolvedValueOnce(insideStore);

    expect(await guardAttachments({ attachments: ["shot.png", "keys/author.pem"], placeInStore })).toEqual(
      fail({ kind: "attachment-refused", attachment: "keys/author.pem" }),
    );
  });

  it("refuses a store path hidden in front of alt text", async () => {
    const placeInStore = vi
      .fn<StorePlacementCheck>()
      .mockResolvedValueOnce(outsideStore)
      .mockResolvedValueOnce(insideStore)
      .mockResolvedValueOnce(outsideStore);

    expect(await guardAttachments({ attachments: ["keys/a#b.pem#Alt"], placeInStore })).toEqual(
      fail({ kind: "attachment-refused", attachment: "keys/a#b.pem#Alt" }),
    );
  });

  it("checks every reading of a '#' as the end of the path", async () => {
    const placeInStore = vi.fn<StorePlacementCheck>().mockResolvedValue(outsideStore);

    await guardAttachments({ attachments: ["keys/a#b.pem#Alt"], placeInStore });

    expect(placeInStore).toHaveBeenNthCalledWith(1, "keys/a");
    expect(placeInStore).toHaveBeenNthCalledWith(2, "keys/a#b.pem");
    expect(placeInStore).toHaveBeenNthCalledWith(3, "keys/a#b.pem#Alt");
  });
});

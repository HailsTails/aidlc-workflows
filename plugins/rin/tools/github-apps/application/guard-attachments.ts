import { fail, succeed, type Result } from "../domain/result.ts";
import type { StorePlacementCheck } from "./credential-store-boundary.ts";

const ALT_TEXT_SEPARATOR = "#";

type AttachmentRefused = {
  readonly kind: "attachment-refused";
  readonly attachment: string;
};

type AttachmentGuarding = {
  readonly attachments: readonly string[];
  readonly placeInStore: StorePlacementCheck;
};

const candidatePaths = (attachment: string): readonly string[] =>
  attachment
    .split(ALT_TEXT_SEPARATOR)
    .map((_, end, parts) => parts.slice(0, end + 1).join(ALT_TEXT_SEPARATOR))
    .filter((candidate) => candidate !== "");

const reachesStore = async (
  attachment: string,
  placeInStore: StorePlacementCheck,
): Promise<boolean> => {
  const placements = await Promise.all(
    candidatePaths(attachment).map((candidate) => placeInStore(candidate)),
  );
  return placements.some((placement) => placement.kind === "inside-store");
};

const guardAttachments = async ({
  attachments,
  placeInStore,
}: AttachmentGuarding): Promise<Result<void, AttachmentRefused>> => {
  const verdicts = await Promise.all(
    attachments.map(async (attachment) => ({
      attachment,
      refused: await reachesStore(attachment, placeInStore),
    })),
  );
  const refused = verdicts.find((verdict) => verdict.refused);
  return refused === undefined
    ? succeed(undefined)
    : fail({ kind: "attachment-refused", attachment: refused.attachment });
};

export { guardAttachments, type AttachmentRefused };

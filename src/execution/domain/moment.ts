import type { Timestamp } from "../../kernel/values.ts";

export type MomentOrder = "earlier" | "same" | "later";

const MILLISECOND_DIGITS = 3;

const sortableMoment = (moment: Timestamp): string => {
  const [seconds = "", fraction = ""] = moment.slice(0, -1).split(".");
  return `${seconds}.${fraction.padEnd(MILLISECOND_DIGITS, "0")}`;
};

export const orderOf = (moment: Timestamp, reference: Timestamp): MomentOrder => {
  const subject = sortableMoment(moment);
  const against = sortableMoment(reference);
  if (subject === against) {
    return "same";
  }
  return subject < against ? "earlier" : "later";
};

import type { ReviewRecord } from "./pull-request.ts";

type ReviewVerdict = ReviewRecord & { readonly stance: "approved" | "changes-requested" };

const isVerdict = (review: ReviewRecord): review is ReviewVerdict =>
  review.stance === "approved" || review.stance === "changes-requested";

const latestVerdict = (reviews: readonly ReviewRecord[]): ReviewVerdict | undefined =>
  reviews.filter(isVerdict).at(-1);

export { latestVerdict, type ReviewVerdict };

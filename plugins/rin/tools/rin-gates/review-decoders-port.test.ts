import { describe, expect, test } from "vitest";
import { defaultReviewDecodersPort } from "./review-decoders-port.ts";

const decoders = defaultReviewDecodersPort();

describe("review decoding boundary", () => {
  test("malformed captures expose no vendor error object", () => {
    expect(decoders.capture({ lens: "reviewer", verdict: "READY" })).toEqual({ success: false });
  });

  test("keeps route defaults and rejects unknown routes", () => {
    expect(decoders.route(undefined)).toEqual({ success: true, data: "conductor-report" });
    expect(decoders.route("invented-route")).toEqual({ success: false });
  });

  test("rejects missing native handback identity", () => {
    expect(decoders.handback({ reportText: "READY" })).toEqual({ success: false });
  });

  test("reports valid captures as owned data", () => {
    expect(decoders.capture({ lens: "reviewer", verdict: "NOT-READY", findings: ["live finding"], sessionId: "session", at: "time", vendorField: "discard" })).toEqual({ success: true, data: { lens: "reviewer", verdict: "NOT-READY", findings: ["live finding"], sessionId: "session", at: "time" } });
  });
});

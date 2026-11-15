import { describe, expect, it } from "vitest";
import { secret } from "./secret.ts";
import { assessGrantFreshness, grantIssuedAt } from "./user-grant.ts";

const accessToken = secret("ghu_access");

const refreshToken = secret("ghr_refresh");

const grant = {
  accessToken,
  accessTokenExpiresAtEpochSeconds: 10_000,
  refreshToken,
  refreshTokenExpiresAtEpochSeconds: 90_000,
};

describe("assessGrantFreshness", () => {
  it("calls an access token usable while more than the use margin remains", () => {
    expect(assessGrantFreshness({ grant, nowEpochSeconds: 9_699 })).toBe("usable");
  });

  it("calls the grant refreshable once the access token is inside the use margin", () => {
    expect(assessGrantFreshness({ grant, nowEpochSeconds: 9_700 })).toBe("refreshable");
  });

  it("calls the grant refreshable until the refresh token expires", () => {
    expect(assessGrantFreshness({ grant, nowEpochSeconds: 89_999 })).toBe("refreshable");
  });

  it("calls the grant expired once the refresh token has expired", () => {
    expect(assessGrantFreshness({ grant, nowEpochSeconds: 90_000 })).toBe("expired");
  });
});

describe("grantIssuedAt", () => {
  it("dates both tokens from the moment they were issued", () => {
    const dated = grantIssuedAt({
      issued: {
        accessToken,
        accessTokenLifetimeSeconds: 28_800,
        refreshToken,
        refreshTokenLifetimeSeconds: 15_897_600,
      },
      nowEpochSeconds: 1_700_000_000,
    });

    expect(dated).toEqual({
      accessToken,
      accessTokenExpiresAtEpochSeconds: 1_700_028_800,
      refreshToken,
      refreshTokenExpiresAtEpochSeconds: 1_715_897_600,
    });
  });
});

import { fail, succeed, type Result } from "./result.ts";

const CREATED_URL_NUMBER = /\/(?:pull|issues)\/([1-9]\d*)$/;

type CreatedNumberUnreadable = { readonly kind: "created-number-unreadable" };

const createdNumberOf = (standardOutput: string): Result<number, CreatedNumberUnreadable> => {
  const createdNumber = CREATED_URL_NUMBER.exec(standardOutput.trim())?.[1];
  return createdNumber === undefined
    ? fail({ kind: "created-number-unreadable" })
    : succeed(Number(createdNumber));
};

export { createdNumberOf, type CreatedNumberUnreadable };

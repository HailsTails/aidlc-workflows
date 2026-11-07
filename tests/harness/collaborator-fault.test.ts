import { expect, mock, test } from "bun:test";
import { collaboratorFault } from "./collaborator-fault.ts";

test("a faulting collaborator raises the exact supplied error", () => {
  const failure = new Error("dependency unavailable");
  const collaborator = mock(collaboratorFault(failure));
  expect(collaborator).toThrow("dependency unavailable");
  expect(collaborator.mock.results[0]?.value).toBe(failure);
});

test("repeated calls retain the same error rather than manufacturing replacements", () => {
  const failure = new RangeError("dependency range");
  const collaborator = mock(collaboratorFault(failure));
  expect(collaborator).toThrow(RangeError);
  expect(collaborator).toThrow(RangeError);
  expect(collaborator.mock.results[0]?.value).toBe(failure);
  expect(collaborator.mock.results[1]?.value).toBe(failure);
});

test("independent collaborators do not share their fault state", () => {
  const firstFailure = new Error("first dependency");
  const secondFailure = new Error("second dependency");
  const first = mock(collaboratorFault(firstFailure));
  const second = mock(collaboratorFault(secondFailure));
  expect(first).toThrow("first dependency");
  expect(second).toThrow("second dependency");
  expect(first.mock.results[0]?.value).toBe(firstFailure);
  expect(second.mock.results[0]?.value).toBe(secondFailure);
});

export type FreshWorkspaceSeed = {
  readonly file: "aidlc/active-space";
  readonly content: "default\n";
};

// Release-tree seed data; runtime fallback, copy omissions and a person's existing cursor have separate owners.
export function freshWorkspaceSeed(): FreshWorkspaceSeed {
  return { file: "aidlc/active-space", content: "default\n" };
}

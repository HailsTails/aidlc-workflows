export type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

// A synchronous dependency fault for tests of boundaries that preserve exceptions.
// This fixture owns only raising the supplied error, never the product call or its assertions.
export function collaboratorFault(failure: Error): () => never {
  return () => { throw failure; };
}

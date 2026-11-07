type Sentinel = { readonly kind: "sentinel"; readonly id: string };

const isSentinel = (candidate: unknown): candidate is Sentinel => {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "kind" in candidate &&
    (candidate as { readonly kind: unknown }).kind === "sentinel"
  );
};

export { isSentinel };

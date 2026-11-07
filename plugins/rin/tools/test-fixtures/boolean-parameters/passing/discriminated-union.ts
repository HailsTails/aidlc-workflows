type ForceMode = { readonly kind: "force" } | { readonly kind: "lenient" };

const performAction = (mode: ForceMode): string => {
  if (mode.kind === "force") {
    return "forced";
  }
  return "lenient";
};

export { performAction };

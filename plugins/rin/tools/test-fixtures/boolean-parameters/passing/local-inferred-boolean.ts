type VisibilityState = "shown" | "hidden";

const summariseVisibility = (visibility: VisibilityState): string => {
  const isShown = visibility === "shown";
  if (isShown) {
    return "visible";
  }
  return "hidden";
};

export { summariseVisibility };

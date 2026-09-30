const performAction = (shouldForce: boolean): string => {
  if (shouldForce) {
    return "forced";
  }
  return "lenient";
};

export { performAction };

const performAction = (shouldForce: boolean | undefined): string => {
  if (shouldForce === true) {
    return "forced";
  }
  return "lenient";
};

export { performAction };

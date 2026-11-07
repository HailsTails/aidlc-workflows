type Category = "inbox" | "today";

const forceCategory = (rawText: string): Category => {
  return rawText as Category;
};

export { forceCategory };

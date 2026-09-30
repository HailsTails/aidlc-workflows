type SearchOptions = {
  readonly searchTerm: string;
  readonly shouldIncludeArchived: boolean;
};

const searchTasks = (searchOptions: SearchOptions): readonly string[] => {
  if (searchOptions.shouldIncludeArchived) {
    return [searchOptions.searchTerm, "archived"];
  }
  return [searchOptions.searchTerm];
};

export { searchTasks };

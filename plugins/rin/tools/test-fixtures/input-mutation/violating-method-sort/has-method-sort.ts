type MutableList = readonly number[];

const sortInPlace = (existingList: MutableList): void => {
  (existingList as number[]).sort();
};

const sortDestructively = (mutableList: number[]): void => {
  mutableList.sort();
};

export { sortDestructively, sortInPlace };

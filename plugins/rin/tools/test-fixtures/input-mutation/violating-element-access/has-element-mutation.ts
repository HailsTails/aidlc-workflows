type MutableArray = number[];

const setFirstElement = (numbers: MutableArray, replacement: number): void => {
  numbers[0] = replacement;
};

export { setFirstElement };

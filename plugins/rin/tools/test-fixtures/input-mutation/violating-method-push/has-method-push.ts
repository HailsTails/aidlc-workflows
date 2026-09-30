type MutableList = number[];

const appendToList = (existingList: MutableList, value: number): void => {
  existingList.push(value);
};

export { appendToList };

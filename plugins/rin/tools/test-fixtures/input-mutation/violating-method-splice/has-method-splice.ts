type MutableList = number[];

const removeRange = (
  existingList: MutableList,
  startIndex: number,
  removeCount: number,
): void => {
  existingList.splice(startIndex, removeCount);
};

export { removeRange };

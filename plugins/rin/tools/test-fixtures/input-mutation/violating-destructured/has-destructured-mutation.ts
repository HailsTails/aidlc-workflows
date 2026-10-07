type Wrapper = { inner: { name: string } };

const renameDestructured = ({ inner }: Wrapper, newName: string): void => {
  inner.name = newName;
};

export { renameDestructured };

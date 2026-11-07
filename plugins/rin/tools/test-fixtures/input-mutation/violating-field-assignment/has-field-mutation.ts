type MutableProfile = { name: string; age: number };

const renameInPlace = (profile: MutableProfile, newName: string): void => {
  profile.name = newName;
};

export { renameInPlace };

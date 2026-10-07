type Profile = { readonly name: string; readonly age: number };

const renameProfile = (
  existingProfile: Profile,
  newName: string,
): Profile => ({
  name: newName,
  age: existingProfile.age,
});

export { renameProfile };

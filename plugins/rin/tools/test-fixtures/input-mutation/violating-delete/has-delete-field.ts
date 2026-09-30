type MutableProfile = { name: string; nickname?: string };

const dropNickname = (profile: MutableProfile): void => {
  delete profile.nickname;
};

export { dropNickname };

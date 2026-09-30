const parseResponseUnsafely = async <T>(response: Response): Promise<T> => {
  const parsed = await response.json();
  return parsed as T;
};

export { parseResponseUnsafely };

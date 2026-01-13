export const isValidByteLength = (str: string, maxBytes: number): boolean => {
  const encoded = new TextEncoder().encode(str);
  return encoded.length < maxBytes;
};

import sodium from "libsodium-wrappers";
import { isValidByteLength } from "../utils/string";

const PUBLIC_KEY_BASE64 = import.meta.env.VITE_MCP_SERVER_PUBLIC_KEY;

/**
 * Verschlüsselt einen einzelnen Wert mit nativem Padding
 */
async function encryptValue(value: string, blockSize: number): Promise<string> {
  if (!value || value.trim() === "") {
    return "";
  }
  if (!PUBLIC_KEY_BASE64) {
    throw new Error("VITE_MCP_SERVER_PUBLIC_KEY is not defined");
  }

  await sodium.ready;

  const message = new TextEncoder().encode(value);
  const padded = sodium.pad(message, blockSize);

  if (!isValidByteLength(value, blockSize)) {
    return value;
  }
  const publicKey = sodium.from_base64(PUBLIC_KEY_BASE64);
  const sealed = sodium.crypto_box_seal(padded, publicKey);

  return sodium.to_base64(sealed);
}

/**
 * Verschlüsselt nur die 'value' Felder im Payload
 */
export async function encryptPayload(
  payload: Record<
    string,
    Record<string, { value: string; description: string; limit: string }>
  >
): Promise<
  Record<
    string,
    Record<string, { value: string; description: string; limit: string }>
  >
> {
  await sodium.ready;

  const result: typeof payload = {};

  for (const [categoryKey, fields] of Object.entries(payload)) {
    result[categoryKey] = {};

    for (const [fieldKey, config] of Object.entries(fields)) {
      const blockSize = parseInt(config.limit, 10) || 256;
      const encryptedValue = await encryptValue(config.value, blockSize);

      result[categoryKey][fieldKey] = {
        ...config,
        value: encryptedValue,
      };
    }
  }

  return result;
}

import { initState } from "../context/initState";
import type { Options } from "../context/types";
import {
  chatVault,
  VaultError,
  type VaultUserKey,
} from "./chatVault";
import {
  decryptChatData,
  encryptChatData,
  generateChatKey,
  LEGACY_RSA_KEY_ALGORITHM,
  unwrapChatKey,
  wrapChatKey,
} from "../utils/zeroKnowledgeCrypto";
import { reviver } from "../utils/settings";

type EncryptedSettings = { version: 1; json: string };

export type VaultSettingsSyncState = {
  rev: number;
  fingerprint: string;
  available: boolean;
};

export type RestoredVaultSettings = {
  options: Options;
  syncState: VaultSettingsSyncState;
};

function settingsReplacer(_key: string, value: unknown) {
  if (value instanceof Map) {
    return { dataType: "Map", value: Array.from(value.entries()) };
  }
  if (value instanceof Set) {
    return { dataType: "Set", value: Array.from(value) };
  }
  return value;
}

/** The vault opt-in is device-local and must never enable storage by itself. */
function settingsJson(options: Options): string {
  return JSON.stringify(
    {
      ...options,
      general: { ...options.general, zkStorage: false },
    },
    settingsReplacer
  );
}

function fingerprint(options: Options): string {
  return settingsJson(options);
}

function mergeSyncedSettings(
  json: string,
  currentOptions: Options
): Options {
  const parsed = JSON.parse(json, reviver) as Partial<Options>;
  const remoteGeneral = parsed.general ?? {};
  return {
    account: { ...initState.options.account, ...parsed.account },
    general: {
      ...initState.options.general,
      ...remoteGeneral,
      // Enabling the vault remains an explicit, per-device choice.
      zkStorage: currentOptions.general.zkStorage ?? true,
    },
    openai: { ...initState.options.openai, ...parsed.openai },
  };
}

async function decryptSettings(
  encrypted: Awaited<ReturnType<typeof chatVault.getSettings>>,
  privateKey: CryptoKey,
  currentOptions: Options
): Promise<RestoredVaultSettings> {
  const envelope = encrypted.selfEnvelope;
  const key = await unwrapChatKey(envelope, privateKey);
  const payload = await decryptChatData<EncryptedSettings>(encrypted, key);
  if (payload?.version !== 1 || typeof payload.json !== "string") {
    throw new Error("The encrypted settings document has an unsupported format");
  }
  const options = mergeSyncedSettings(payload.json, currentOptions);
  return {
    options,
    syncState: {
      rev: encrypted.rev,
      fingerprint: fingerprint(options),
      available: true,
    },
  };
}

async function writeSettings(
  options: Options,
  userKey: VaultUserKey,
  baseRev: number
): Promise<number> {
  const key = await generateChatKey();
  const encrypted = await encryptChatData(
    { version: 1, json: settingsJson(options) } satisfies EncryptedSettings,
    key
  );
  const wrapped = await wrapChatKey(
    key,
    userKey.publicKey,
    userKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
  );
  const result = await chatVault.putSettings({
    ...encrypted,
    selfEnvelope: { recipientId: userKey.userId, ...wrapped },
    baseRev,
  });
  return result.rev;
}

/** Restore encrypted settings, or seed the vault from this device on first use. */
export async function restoreVaultSettings(
  currentOptions: Options,
  privateKey: CryptoKey,
  userKey: VaultUserKey
): Promise<RestoredVaultSettings> {
  let encrypted;
  try {
    encrypted = await chatVault.getSettings();
  } catch (error) {
    if (!(error instanceof VaultError && error.status === 404)) throw error;
    try {
      const rev = await writeSettings(currentOptions, userKey, 0);
      return {
        options: currentOptions,
        syncState: { rev, fingerprint: fingerprint(currentOptions), available: true },
      };
    } catch (writeError) {
      if (writeError instanceof VaultError && writeError.status === 404) {
        console.warn("The vault backend does not support encrypted settings sync yet");
        return {
          options: currentOptions,
          syncState: {
            rev: 0,
            fingerprint: fingerprint(currentOptions),
            available: false,
          },
        };
      }
      // Another device may have created the initial document at the same time.
      if (!(writeError instanceof VaultError && writeError.status === 409)) {
        throw writeError;
      }
      encrypted = await chatVault.getSettings();
    }
  }
  return decryptSettings(encrypted, privateKey, currentOptions);
}

/** Upload settings changes with revision checks so concurrent devices converge. */
export async function syncVaultSettings(
  options: Options,
  userKey: VaultUserKey,
  syncState: VaultSettingsSyncState
): Promise<VaultSettingsSyncState> {
  if (!syncState.available) return syncState;
  const nextFingerprint = fingerprint(options);
  if (nextFingerprint === syncState.fingerprint) return syncState;

  let baseRev = syncState.rev;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const rev = await writeSettings(options, userKey, baseRev);
      return { rev, fingerprint: nextFingerprint };
    } catch (error) {
      if (!(error instanceof VaultError && error.status === 409)) throw error;
      const current = await chatVault.getSettings();
      baseRev = current.rev;
    }
  }
  throw new Error("Settings changed repeatedly on another device; try again");
}

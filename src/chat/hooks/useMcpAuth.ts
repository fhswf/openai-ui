import * as jose from "jose";
import { McpAuthConfig } from "../context/types";

const BLOCKED_FIELDS = new Set(["__proto__", "constructor", "prototype"]);

export function useMcpAuth(user: Record<string, unknown> | null) {
  const getAuthorization = async (
    config: McpAuthConfig,
    serverUrl: string
  ): Promise<string | undefined> => {
    switch (config.mode) {
      case "none":
        return undefined;

      case "static":
        return config.staticToken?.trim() ?? undefined;

      case "user-data": {
        if (!config.selectedFields.length || !serverUrl || !user) {
          return undefined;
        }

        const filteredData = Object.fromEntries(
          config.selectedFields
            .filter((f) => !BLOCKED_FIELDS.has(f) && Object.hasOwn(user, f))
            .map((f) => [f, user[f]])
        );

        if (!Object.keys(filteredData).length) {
          return undefined;
        }

        try {
          const jwksUrl = new URL(
            "/.well-known/jwks.json",
            serverUrl
          ).toString();
          const jwksResponse = await fetch(jwksUrl);

          if (!jwksResponse.ok) {
            throw new Error(
              `JWKS fetch failed: ${jwksResponse.status} ${jwksResponse.statusText}`
            );
          }

          const jwks = await jwksResponse.json();

          if (
            !jwks?.keys ||
            !Array.isArray(jwks.keys) ||
            jwks.keys.length === 0
          ) {
            throw new Error("JWKS response contains no valid keys");
          }

          const firstKey = jwks.keys[0];
          const mcpPublicKey = await jose.importJWK(firstKey, "RSA-OAEP-256");

          const payload = JSON.stringify({ data: filteredData });
          return await new jose.CompactEncrypt(
            new TextEncoder().encode(payload)
          )
            .setProtectedHeader({
              alg: "RSA-OAEP-256",
              enc: "A256GCM",
              typ: "JWT",
            })
            .encrypt(mcpPublicKey);
        } catch (error) {
          console.error("Error encrypting user data:", error);
          throw new Error(
            `Verschlüsselung fehlgeschlagen: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      default:
        return undefined;
    }
  };

  const userFields = user ? Object.keys(user) : [];

  return { getAuthorization, userFields };
}

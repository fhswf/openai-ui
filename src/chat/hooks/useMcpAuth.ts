import { McpAuthConfig } from "../context/types";

export interface UseMcpAuthReturn {
  getAuthorization: (config: McpAuthConfig) => Promise<string | undefined>;
}

export function useMcpAuth(): UseMcpAuthReturn {
  const getAuthorization = async (
    config: McpAuthConfig
  ): Promise<string | undefined> => {
    switch (config.mode) {
      case "none":
        return undefined;

      case "static":
        return config.staticToken?.trim() || undefined;

      case "user-data":
        if (!config.selectedFields.length) {
          return undefined;
        }

        try {
          const res = await fetch("/api/user/encrypted-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields: config.selectedFields }),
          });

          if (!res.ok) {
            console.error(
              "Failed to get encrypted token:",
              res.status,
              res.statusText
            );
            return undefined;
          }

          const { token } = await res.json();
          return token;
        } catch (error) {
          console.error("Error fetching encrypted token:", error);
          return undefined;
        }

      default:
        return undefined;
    }
  };

  return { getAuthorization };
}

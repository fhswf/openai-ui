import { McpAuthConfig } from "../context/types";

export interface UseMcpAuthReturn {
  getAuthorization: (
    config: McpAuthConfig,
    serverUrl: string
  ) => Promise<string | undefined>;
  userFields: string[];
}

export function useMcpAuth(
  user: Record<string, unknown> | null
): UseMcpAuthReturn {
  const getAuthorization = async (
    config: McpAuthConfig,
    serverUrl: string
  ): Promise<string | undefined> => {
    switch (config.mode) {
      case "none":
        return undefined;

      case "static":
        return config.staticToken?.trim() || undefined;

      case "user-data":
        if (!config.selectedFields.length || !serverUrl) {
          return undefined;
        }

        try {
          const res = await fetch(
            `${import.meta.env.VITE_USER_URL}/encrypted-token`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                fields: config.selectedFields,
                server_url: serverUrl,
              }),
            }
          );

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

  const userFields = user ? Object.keys(user) : [];

  return { getAuthorization, userFields };
}

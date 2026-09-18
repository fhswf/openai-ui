/**
 * OpenAI validates the `server_label` of an MCP tool and rejects the whole
 * request when it does not match this pattern. Keep the dialog in sync with
 * the API so users cannot save a tool that will always fail at runtime.
 */
export const MCP_TOOL_NAME_MAX_LENGTH = 64;

const MCP_TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isValidMcpToolName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= MCP_TOOL_NAME_MAX_LENGTH &&
    MCP_TOOL_NAME_PATTERN.test(name)
  );
}

/**
 * Turns a free-form display name into a legal `server_label` by replacing every
 * run of illegal characters with a single underscore.
 */
export function sanitizeMcpToolName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, MCP_TOOL_NAME_MAX_LENGTH);
}

/**
 * The server label is derived from the display name, but the user may override
 * it. It keeps tracking the name as long as it still equals the sanitized name,
 * and stops doing so as soon as it was edited by hand.
 */
export function mergeServerLabelOnNameChange(args: {
  currentLabel: string;
  currentServerLabel: string;
  nextLabel: string;
}): string {
  if (args.currentServerLabel !== sanitizeMcpToolName(args.currentLabel)) {
    return args.currentServerLabel;
  }

  return sanitizeMcpToolName(args.nextLabel);
}

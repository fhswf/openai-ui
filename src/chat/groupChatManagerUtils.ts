import { toaster } from "../components/ui/toaster";

export function reportGroupError(error: unknown, title: string): void {
  console.error("Group chat operation failed:", error);

  let description: string | undefined;
  if (error instanceof Error) {
    description = error.message || error.name;
  } else if (typeof error === "string") {
    description = error;
  } else if (error !== undefined && error !== null) {
    try {
      description = JSON.stringify(error);
    } catch {
      description = String(error);
    }
  }

  toaster.create({
    title,
    description,
    duration: 8000,
    type: "error",
  });
}

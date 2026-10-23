import { toaster } from "../components/ui/toaster";

export function reportGroupError(error: unknown, title: string): void {
  toaster.create({
    title,
    description: error instanceof Error ? error.message : undefined,
    duration: 8000,
    type: "error",
  });
}

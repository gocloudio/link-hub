import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn("min-w-0 disabled:opacity-50", className)}
      {...props}
    />
  );
}

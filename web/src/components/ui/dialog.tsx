import type { ComponentProps, ReactNode } from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = Primitive.Root;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export function DialogContent({
  children,
  className,
  sheet = false,
  ...props
}: ComponentProps<typeof Primitive.Content> & {
  sheet?: boolean;
  children: ReactNode;
}) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="dialog-overlay" />
      <Primitive.Content
        className={cn("dialog-content", sheet ? "drawer" : "modal", className)}
        {...props}
      >
        {children}
        <Primitive.Close className="icon-button corner-close" aria-label="关闭">
          <X />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";

const alertVariants = {
  default: "border-border bg-background text-foreground",
  destructive: "border-destructive/50 bg-destructive/10 text-destructive",
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof alertVariants;
}

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        alertVariants[variant],
        className
      )}
      {...props}
    />
  );
}

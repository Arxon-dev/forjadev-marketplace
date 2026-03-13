import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
        variant === "primary" && "bg-[var(--primary)] text-white hover:opacity-95",
        variant === "secondary" && "border border-white/10 bg-white/5 text-white hover:bg-white/10",
        variant === "ghost" && "bg-transparent text-white hover:bg-white/5",
        variant === "danger" && "bg-[var(--danger)] text-white hover:opacity-95",
        className
      )}
      {...props}
    />
  );
}

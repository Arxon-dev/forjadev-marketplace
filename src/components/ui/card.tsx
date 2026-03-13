import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
        className
      )}
      {...props}
    />
  );
}

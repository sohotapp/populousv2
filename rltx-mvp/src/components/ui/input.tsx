import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // design.md: Input bg 8%, border 15%, hover border 20%, focus border 25%, 100ms transition
          "flex h-8 w-full rounded-md border border-[hsl(0,0%,15%)] bg-[hsl(0,0%,8%)] px-3 py-1.5 text-sm text-[hsl(0,0%,90%)] transition-all duration-100 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[hsl(0,0%,40%)] hover:border-[hsl(0,0%,20%)] focus-visible:outline-none focus-visible:border-[hsl(0,0%,25%)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

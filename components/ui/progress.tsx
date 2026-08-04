import * as React from "react";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const safeValue = Math.min(100, Math.max(0, Number(value) || 0));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
        className={cn(
          "relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100",
          className,
        )}
        {...props}
      >
        <div
          className="h-full rounded-full bg-slate-950 transition-[width] duration-300"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    );
  },
);

Progress.displayName = "Progress";

export { Progress };

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HoverTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * Drop-in replacement for a native `title="..."` attribute -- same idea
 * (hover to see more), but themed, with a much shorter show delay (see the
 * shared TooltipProvider in routes/__root.tsx) and no OS-specific styling.
 * Renders `children` completely unwrapped (no extra DOM node) whenever
 * `content` is empty/falsy, so it's safe to use unconditionally even where
 * the tooltip text is itself conditional.
 */
export function HoverTooltip({ content, children, side, align, className }: HoverTooltipProps) {
  if (!content) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} className={className}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

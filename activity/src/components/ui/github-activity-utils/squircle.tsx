"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A paint layer clipped to a squircle (a superellipse corner rather than a
 * circular one). It fills its positioned parent and sits underneath the content.
 */

const SMOOTHING = 0.6;

function squirclePath(width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  // how far the curve starts before the corner; more smoothing, longer approach
  const p = Math.min(r * (1 + SMOOTHING), width / 2, height / 2);
  // control points hug the corner (a circle would sit at 0.45p); that is the squircle
  const c = p * 0.9;

  return [
    `M ${p} 0`,
    `L ${width - p} 0`,
    `C ${width - p + c} 0 ${width} ${p - c} ${width} ${p}`,
    `L ${width} ${height - p}`,
    `C ${width} ${height - p + c} ${width - p + c} ${height} ${width - p} ${height}`,
    `L ${p} ${height}`,
    `C ${p - c} ${height} 0 ${height - p + c} 0 ${height - p}`,
    `L 0 ${p}`,
    `C 0 ${p - c} ${p - c} 0 ${p} 0`,
    "Z",
  ].join(" ");
}

export type SquircleProps = React.ComponentProps<"div"> & {
  /** Corner radius in pixels. */
  radius?: number;
};

export const Squircle = ({
  className,
  radius = 28,
  style,
  ...props
}: SquircleProps) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState<{ width: number; height: number }>();

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ width: box.width, height: box.height });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      data-slot="squircle"
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        // a plain rounded corner until the first measurement lands
        borderRadius: size ? undefined : radius,
        clipPath: size
          ? `path("${squirclePath(size.width, size.height, radius)}")`
          : undefined,
        ...style,
      }}
      {...props}
    />
  );
};

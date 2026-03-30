"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface ChartContainerProps {
  children: (width: number, height: number) => React.ReactNode;
  height: number;
  className?: string;
}

/**
 * Measures its own dimensions and passes them to children as render props.
 * This bypasses Recharts' ResponsiveContainer entirely, avoiding the -1 sizing bug.
 */
export function ChartContainer({ children, height, className }: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const measure = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        setSize({ w: Math.floor(rect.width), h: height });
      }
    }
  }, [height]);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(() => measure());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div ref={containerRef} style={{ height, width: "100%" }} className={className}>
      {size ? children(size.w, size.h) : null}
    </div>
  );
}

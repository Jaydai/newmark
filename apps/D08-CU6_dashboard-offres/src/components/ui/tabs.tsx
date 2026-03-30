"use client";

import { useState } from "react";
import { clsx } from "clsx";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (id: string) => void;
  children: (activeTab: string) => React.ReactNode;
}

export function Tabs({ tabs, defaultTab, onChange, children }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");

  const handleChange = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  return (
    <div>
      <div className="flex gap-1 p-1 bg-surface-hover rounded-lg mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={clsx(
              "px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-all duration-200",
              active === tab.id
                ? "bg-surface text-foreground shadow-[var(--shadow-sm)]"
                : "text-text-secondary hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={clsx(
                  "ml-2 text-xs px-1.5 py-0.5 rounded-full",
                  active === tab.id ? "bg-accent-light text-accent" : "bg-border text-text-tertiary"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <div key={active}>{children(active)}</div>
    </div>
  );
}

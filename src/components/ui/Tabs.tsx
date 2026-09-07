"use client";

import {
  createContext,
  useContext,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

const TabsPanelContext = createContext<{ activeValue: string; baseId: string } | null>(null);

export function Tabs({ items, value, defaultValue, onValueChange, className }: TabsProps) {
  const baseId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.value ?? "");
  const activeValue = value ?? internalValue;

  function select(next: string) {
    setInternalValue(next);
    onValueChange?.(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const enabled = items.filter((item) => !item.disabled);
    const currentIndex = enabled.findIndex((item) => item.value === items[index].value);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = enabled[(currentIndex + direction + enabled.length) % enabled.length];
    if (next) select(next.value);
  }

  return (
    <TabsPanelContext.Provider value={{ activeValue, baseId }}>
      <div
        role="tablist"
        className={cn("inline-flex items-center gap-1 rounded-pill bg-verity-bg p-1", className)}
      >
        {items.map((item, index) => {
          const selected = item.value === activeValue;
          return (
            <button
              key={item.value}
              role="tab"
              type="button"
              id={`${baseId}-tab-${item.value}`}
              aria-controls={`${baseId}-panel-${item.value}`}
              aria-selected={selected}
              disabled={item.disabled}
              tabIndex={selected ? 0 : -1}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onClick={() => select(item.value)}
              className={cn(
                "focus-ring rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                selected
                  ? "bg-white text-verity-primary shadow-brand"
                  : "text-verity-ink-muted hover:text-verity-ink",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </TabsPanelContext.Provider>
  );
}

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className }: TabPanelProps) {
  const ctx = useContext(TabsPanelContext);
  if (!ctx || ctx.activeValue !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-tab-${value}`}
      className={className}
    >
      {children}
    </div>
  );
}

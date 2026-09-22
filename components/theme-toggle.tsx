"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const themes = ["system", "light", "dark"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return <span className="theme-toggle theme-toggle-placeholder" aria-hidden="true" />;
  const current = themes.includes(theme as (typeof themes)[number]) ? theme as (typeof themes)[number] : "system";
  const next = themes[(themes.indexOf(current) + 1) % themes.length];
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;
  return <button className="theme-toggle" type="button" onClick={() => setTheme(next)} aria-label={`Theme: ${current}. Switch to ${next}.`} title={`Theme: ${current}`}><Icon size={14} strokeWidth={1.7} /><span>{current}</span></button>;
}

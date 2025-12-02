import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface OverviewResponse {
  asset_count: number;
  recent_events: EventRecord[];
  highlighted_assets: AssetRecord[];
}

export interface AssetRecord {
  id?: string;
  name?: string;
  host?: string;
  category?: string;
  tags?: string[];
  raw?: Record<string, unknown>;
}

export interface EventRecord {
  id?: string;
  type?: string;
  message?: string;
  severity?: string;
  created?: string;
  raw?: Record<string, unknown>;
}

export interface InsightResponse {
  totals: { assets: number; events: number };
  severity_breakdown: Record<string, number>;
  asset_categories: Record<string, number>;
}

export async function fetchFromBackend<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_DASHBOARD_API ?? "http://localhost:8000";
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    // revalidate dashboard data automatically
    next: { revalidate: 30 }
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function formatDate(value?: string) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

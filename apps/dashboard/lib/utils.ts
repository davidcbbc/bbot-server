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
  totals: {
    assets: number;
    events: number;
    targets: number;
    technologies: number;
    open_ports: number;
    hosts_with_open_ports: number;
  };
  severity_breakdown: Record<string, number>;
  asset_categories: Record<string, number>;
  technologies: TechnologySummary[];
  open_ports: PortInsight[];
}

export interface TechnologySummary {
  technology: string;
  hosts: string[];
  last_seen?: string;
}

export interface PortInsight {
  port: string;
  hosts: string[];
  count: number;
}

async function parseJsonWithNdjsonFallback(response: Response) {
  const bodyText = await response.text();

  try {
    return JSON.parse(bodyText);
  } catch (error) {
    const lines = bodyText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      throw error;
    }

    const parsedLines = lines.map((line) => JSON.parse(line));
    return parsedLines;
  }
}

export async function fetchFromBbot<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = (process.env.NEXT_PUBLIC_BBOT_API ?? "http://localhost:8807/v1").replace(/\/$/, "");
  const apiKey = process.env.NEXT_PUBLIC_BBOT_API_KEY;

  const headers = new Headers(options?.headers ?? {});
  if (apiKey) headers.set("X-API-Key", apiKey);

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    // BBOT payloads can exceed the Next.js data cache size; avoid caching to prevent 2MB limit errors.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }

  const payload = await parseJsonWithNdjsonFallback(response);
  return payload as T;
}

async function safeFetchFromBbot<T>(path: string, fallback: T): Promise<T> {
  try {
    return await fetchFromBbot<T>(path);
  } catch (error) {
    console.error(`[dashboard] failed to load ${path}:`, error);
    return fallback;
  }
}

function extractRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    for (const key of ["results", "data", "items", "records"]) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
    return [payload];
  }

  return [];
}

function normalizeTags(rawTags: unknown): string[] {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) return rawTags.map(String);
  return [String(rawTags)];
}

function normalizeAsset(record: unknown): AssetRecord {
  const data = (record ?? {}) as Record<string, unknown>;
  return {
    id: typeof data._id === "string" ? data._id : undefined,
    name: typeof data.name === "string" ? data.name : undefined,
    host: (data.host ?? data.hostname ?? data.name) as string | undefined,
    category: typeof data.category === "string" ? data.category : undefined,
    tags: normalizeTags(data.tags),
    raw: data,
  };
}

function normalizeEvent(record: unknown): EventRecord {
  const data = (record ?? {}) as Record<string, unknown>;
  return {
    id: typeof data._id === "string" ? data._id : undefined,
    type: typeof data.type === "string" ? data.type : undefined,
    message: (data.message ?? data.title) as string | undefined,
    severity: typeof data.severity === "string" ? data.severity : undefined,
    created: typeof data.created === "string" ? data.created : undefined,
    raw: data,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeTechnologySummary(value: unknown): TechnologySummary[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return undefined;
      const record = entry as Record<string, unknown>;
      const technology = record.technology;
      const hosts = Array.isArray(record.hosts) ? record.hosts.map(String) : [];
      if (typeof technology !== "string") return undefined;
      return { technology, hosts, last_seen: typeof record.last_seen === "string" ? record.last_seen : undefined };
    })
    .filter(Boolean) as TechnologySummary[];
}

function normalizePortInsights(hostsToPorts: unknown): PortInsight[] {
  if (!isRecord(hostsToPorts)) return [];

  const portToHosts = Object.entries(hostsToPorts).reduce<Record<string, Set<string>>>((acc, [host, ports]) => {
    if (!Array.isArray(ports)) return acc;
    ports.forEach((portValue) => {
      const port = String(portValue);
      if (!acc[port]) acc[port] = new Set<string>();
      acc[port].add(host);
    });
    return acc;
  }, {});

  return Object.entries(portToHosts)
    .map(([port, hosts]) => ({ port, hosts: Array.from(hosts).sort(), count: hosts.size }))
    .sort((a, b) => b.count - a.count);
}

function normalizeStats(stats: unknown) {
  if (!isRecord(stats)) return {} as Record<string, unknown>;
  return stats;
}

export async function loadDashboardData(limit = 50): Promise<{ overview: OverviewResponse; insights: InsightResponse }> {
  const query = limit ? `?limit=${limit}` : "";
  const [hostsPayload, eventsPayload, statsPayload, technologiesPayload, openPortsPayload, targetsPayload] =
    await Promise.all([
      fetchFromBbot<unknown>(`/assets/hosts${query}`),
      fetchFromBbot<unknown>(`/events/list${query}`),
      safeFetchFromBbot<Record<string, unknown>>("/assets/stats", {}),
      safeFetchFromBbot<unknown>(`/assets/technologies/summarize${query}`, []),
      safeFetchFromBbot<unknown>(`/assets/open_ports/list${query}`, {}),
      safeFetchFromBbot<number>("/scans/targets/count", 0),
    ]);

  const hosts = extractRecords(hostsPayload).map(normalizeAsset);
  const events = extractRecords(eventsPayload).map(normalizeEvent);

  const highlighted_assets = hosts.slice(0, 5);
  const recent_events = events.slice(0, 10);

  const overview: OverviewResponse = { asset_count: hosts.length, highlighted_assets, recent_events };

  const severity_breakdown = events.reduce<Record<string, number>>((acc, event) => {
    const severity = (event.severity ?? "unknown").toLowerCase();
    acc[severity] = (acc[severity] ?? 0) + 1;
    return acc;
  }, {});

  const asset_categories = hosts.reduce<Record<string, number>>((acc, host) => {
    const category = (host.category ?? "uncategorized").toLowerCase();
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, {});

  const stats = normalizeStats(statsPayload);
  const statsTechnologies = normalizeTechnologySummary(technologiesPayload);
  const open_ports = normalizePortInsights(openPortsPayload);

  const openPortHosts = new Set<string>();
  open_ports.forEach((port) => port.hosts.forEach((host) => openPortHosts.add(host)));

  const technologyCountFromStats = (() => {
    const techs = (stats as Record<string, unknown>)["technologies"];
    return isRecord(techs) ? Object.keys(techs).length : 0;
  })();

  const totals = {
    assets: hosts.length,
    events: events.length,
    targets: typeof targetsPayload === "number" ? targetsPayload : 0,
    technologies: statsTechnologies.length || technologyCountFromStats,
    open_ports: open_ports.reduce((sum, port) => sum + port.count, 0),
    hosts_with_open_ports: openPortHosts.size,
  };

  const insights: InsightResponse = {
    totals,
    severity_breakdown,
    asset_categories,
    technologies: statsTechnologies,
    open_ports,
  };

  return { overview, insights };
}

export function formatDate(value?: string) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

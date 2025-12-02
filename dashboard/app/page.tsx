"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { RefreshCw, ShieldAlert, Radio, Cpu, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard } from "@/components/chart-card";
import { cn } from "@/lib/utils";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const STORAGE_KEY = "bbot-dashboard-settings";
const severityOrder = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const severityColors: Record<string, string> = {
  INFO: "#38bdf8",
  LOW: "#22c55e",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

interface StatsResponse {
  open_ports?: Record<string, number>;
  technologies?: Record<string, number>;
  findings?: {
    max_severity?: string | null;
    max_severity_score?: number;
    severities?: Record<string, number>;
    counts_by_host?: Record<string, number>;
    severities_by_host?: Record<string, { max_severity: string; max_severity_score: number }>;
  };
}

interface AssetDetail {
  host: string;
  technologies?: string[];
  open_ports?: number[];
  finding_max_severity?: string | null;
  finding_severities?: Record<string, number>;
  findings?: string[];
}

interface AssetRow {
  host: string;
  technologies: string[];
  openPorts: number[];
  findings: string[];
  findingSeverities: Record<string, number>;
  maxSeverity?: string | null;
}

type StoredSettings = {
  baseUrl: string;
  apiKey: string;
};

const numberFormatter = new Intl.NumberFormat("en", { notation: "compact" });

function normalizeBaseUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

async function fetchJson<T>(url: string, apiKey: string) {
  const response = await fetch(url, {
    headers: apiKey ? { "X-API-Key": apiKey } : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function fetchAssetDetails(hosts: string[], baseUrl: string, apiKey: string): Promise<AssetRow[]> {
  const limitedHosts = hosts.slice(0, 5);
  const details = await Promise.all(
    limitedHosts.map(async (host) => {
      try {
        const asset = await fetchJson<AssetDetail>(`${baseUrl}/assets/${encodeURIComponent(host)}/detail`, apiKey);
        return {
          host: asset.host || host,
          technologies: asset.technologies ?? [],
          openPorts: asset.open_ports ?? [],
          findings: asset.findings ?? [],
          findingSeverities: asset.finding_severities ?? {},
          maxSeverity: asset.finding_max_severity ?? null,
        };
      } catch (error) {
        console.error(`Failed to load asset detail for ${host}`, error);
        return {
          host,
          technologies: [],
          openPorts: [],
          findings: [],
          findingSeverities: {},
          maxSeverity: null,
        };
      }
    })
  );
  return details;
}

export default function DashboardPage() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:8807/v1");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [hosts, setHosts] = useState<string[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredSettings = JSON.parse(stored);
        setBaseUrl(parsed.baseUrl);
        setApiKey(parsed.apiKey);
      } catch (err) {
        console.error("Failed to parse stored settings", err);
      }
    }
  }, []);

  const handleSaveSettings = () => {
    const settings: StoredSettings = { baseUrl: normalizeBaseUrl(baseUrl), apiKey };
    setBaseUrl(settings.baseUrl);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  };

  const loadData = async () => {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    if (!normalizedBaseUrl) {
      setError("Please provide the BBOT Server base URL (e.g., http://localhost:8807/v1).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [hostsResponse, statsResponse] = await Promise.all([
        fetchJson<string[]>(`${normalizedBaseUrl}/assets/hosts`, apiKey),
        fetchJson<StatsResponse>(`${normalizedBaseUrl}/stats`, apiKey),
      ]);

      const assetRows = await fetchAssetDetails(hostsResponse, normalizedBaseUrl, apiKey);

      setHosts(hostsResponse);
      setStats(statsResponse);
      setAssets(assetRows);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to fetch dashboard data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const assetCount = hosts.length;
  const technologyCount = useMemo(() => {
    if (!stats?.technologies) return 0;
    return Object.values(stats.technologies).reduce((acc, count) => acc + count, 0);
  }, [stats]);
  const openPortCount = useMemo(() => {
    if (!stats?.open_ports) return 0;
    return Object.values(stats.open_ports).reduce((acc, count) => acc + count, 0);
  }, [stats]);
  const maxSeverity = stats?.findings?.max_severity ?? null;

  const topOpenPorts = useMemo(() => {
    if (!stats?.open_ports) return [] as Array<[string, number]>;
    return Object.entries(stats.open_ports)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [stats]);

  const topTechnologies = useMemo(() => {
    if (!stats?.technologies) return [] as Array<[string, number]>;
    return Object.entries(stats.technologies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [stats]);

  const severityCounts = useMemo(() => {
    const severities = stats?.findings?.severities ?? {};
    return severityOrder.map((level) => severities[level] ?? 0);
  }, [stats]);

  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0b1224",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.04)" },
        ticks: { color: "#cbd5e1" },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.04)" },
        ticks: { color: "#cbd5e1" },
      },
    },
  };

  const severityTone: Record<string, "default" | "success" | "warning" | "danger"> = {
    INFO: "default",
    LOW: "default",
    MEDIUM: "warning",
    HIGH: "danger",
    CRITICAL: "danger",
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">BBOT observability</p>
          <h1 className="text-3xl font-semibold text-white">Shadcn Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Live KPIs, charts, and asset spotlight pulled directly from the BBOT Server REST API.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated ? (
            <p className="text-xs text-muted-foreground">Last refreshed {new Date(lastUpdated).toLocaleTimeString()}</p>
          ) : null}
          <Button onClick={loadData} disabled={loading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            {loading ? "Refreshing" : "Refresh"}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API connection</CardTitle>
          <CardDescription>Provide your BBOT Server base URL and API key to pull live data.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[2fr_2fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              placeholder="http://localhost:8807/v1"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key">API key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="X-API-Key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>
          <div className="flex gap-2 lg:justify-end">
            <Button variant="secondary" onClick={handleSaveSettings} className="w-full lg:w-auto">
              Save settings
            </Button>
          </div>
        </CardContent>
        {error ? (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <ShieldAlert className="h-4 w-4" />
              <p>{error}</p>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <section className="card-grid">
        <KpiCard
          label="Assets tracked"
          value={numberFormatter.format(assetCount)}
          description="Hosts registered in BBOT"
          icon={<Radio className="h-5 w-5" />}
        />
        <KpiCard
          label="Technology fingerprints"
          value={numberFormatter.format(technologyCount)}
          description="Observed tech matches"
          icon={<Cpu className="h-5 w-5" />}
        />
        <KpiCard
          label="Open ports"
          value={numberFormatter.format(openPortCount)}
          description="Known listening services"
          icon={<Server className="h-5 w-5" />}
        />
        <KpiCard
          label="Max finding severity"
          value={maxSeverity ?? "None"}
          description="Highest observed vulnerability"
          icon={<ShieldAlert className="h-5 w-5" />}
          tone={maxSeverity ? severityTone[maxSeverity] ?? "warning" : "default"}
        />
      </section>

      <section className="chart-grid">
        <div className="lg:col-span-2">
          <ChartCard title="Top open ports" description="Aggregated across all hosts">
            {topOpenPorts.length ? (
              <Bar
                data={{
                  labels: topOpenPorts.map(([port]) => port),
                  datasets: [
                    {
                      label: "Open ports",
                      data: topOpenPorts.map(([, count]) => count),
                      backgroundColor: "rgba(79, 70, 229, 0.7)",
                      borderRadius: 8,
                    },
                  ],
                }}
                options={chartOptions}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No open port data yet. Run a scan to populate stats.</p>
            )}
          </ChartCard>
        </div>
        <ChartCard title="Findings by severity" description="Use to triage remediation">
          {severityCounts.some((count) => count > 0) ? (
            <Doughnut
              data={{
                labels: severityOrder,
                datasets: [
                  {
                    data: severityCounts,
                    backgroundColor: severityOrder.map((level) => severityColors[level]),
                    borderWidth: 0,
                  },
                ],
              }}
              options={{
                plugins: {
                  legend: {
                    position: "bottom" as const,
                    labels: { color: "#cbd5e1" },
                  },
                },
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No findings yet.</p>
          )}
        </ChartCard>
      </section>

      <section className="chart-grid">
        <ChartCard title="Top technologies" description="Counted by affected hosts">
          {topTechnologies.length ? (
            <Bar
              data={{
                labels: topTechnologies.map(([tech]) => tech),
                datasets: [
                  {
                    label: "Hosts",
                    data: topTechnologies.map(([, count]) => count),
                    backgroundColor: "rgba(52, 211, 153, 0.7)",
                    borderRadius: 8,
                  },
                ],
              }}
              options={chartOptions}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No technology fingerprints yet.</p>
          )}
        </ChartCard>
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <CardTitle>Asset spotlight</CardTitle>
              <CardDescription>Recent hosts with notable activity</CardDescription>
            </div>
            <Badge variant="secondary">Top {Math.min(hosts.length, 5) || 0}</Badge>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Host</TableHead>
                  <TableHead>Technologies</TableHead>
                  <TableHead>Open ports</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead className="text-right">Max severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.length ? (
                  assets.map((asset) => (
                    <TableRow key={asset.host}>
                      <TableCell className="font-medium text-white">{asset.host}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {asset.technologies.length ? asset.technologies.join(", ") : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {asset.openPorts.length ? asset.openPorts.join(", ") : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {asset.findings.length
                          ? Object.entries(asset.findingSeverities)
                              .map(([severity, count]) => `${severity}: ${count}`)
                              .join(", ")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {asset.maxSeverity ? (
                          <Badge variant={severityTone[asset.maxSeverity] ?? "default"}>{asset.maxSeverity}</Badge>
                        ) : (
                          <Badge variant="secondary">None</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No assets loaded yet. Refresh after running a scan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

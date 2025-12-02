import { BarChart3, CircuitBoard, Network, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InsightResponse, PortInsight, TechnologySummary } from "@/lib/utils";

interface InsightChartsProps {
  insights: InsightResponse;
}

function InsightBar({
  label,
  value,
  max,
  accent,
  subtitle,
}: {
  label: string;
  value: number;
  max: number;
  accent?: boolean;
  subtitle?: string;
}) {
  const width = max ? Math.max((value / max) * 100, 6) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${accent ? "bg-primary" : "bg-primary/70"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

function TechnologyCard({ technologies }: { technologies: TechnologySummary[] }) {
  const top = technologies.slice(0, 5);
  const max = top[0]?.hosts.length ?? 0;

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardDescription>Stack pulse</CardDescription>
          <CardTitle className="text-2xl">Technologies</CardTitle>
        </div>
        <CircuitBoard className="h-10 w-10 text-primary" />
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        {top.length ? (
          top.map((tech) => (
            <InsightBar
              key={tech.technology}
              label={tech.technology}
              value={tech.hosts.length}
              max={max}
              subtitle={`${tech.hosts.length === 1 ? "Host" : "Hosts"}: ${tech.hosts.slice(0, 3).join(", ")}${
                tech.hosts.length > 3 ? "…" : ""
              }`}
            />
          ))
        ) : (
          <p>No technologies reported yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function OpenPortsCard({ ports }: { ports: PortInsight[] }) {
  const top = ports.slice(0, 5);
  const max = top[0]?.count ?? 0;

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardDescription>Exposed surface</CardDescription>
          <CardTitle className="text-2xl">Open ports</CardTitle>
        </div>
        <Network className="h-10 w-10 text-primary" />
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        {top.length ? (
          top.map((port) => (
            <InsightBar
              key={port.port}
              label={`Port ${port.port}`}
              value={port.count}
              max={max}
              subtitle={`Hosts: ${port.hosts.slice(0, 3).join(", ")}${port.hosts.length > 3 ? "…" : ""}`}
            />
          ))
        ) : (
          <p>Waiting for port telemetry.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function InsightCharts({ insights }: InsightChartsProps) {
  const techCount = insights.technologies.length;
  const portCount = insights.open_ports.length;

  return (
    <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-full">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Scope</CardDescription>
              <CardTitle className="text-2xl">Targets</CardTitle>
            </div>
            <Target className="h-10 w-10 text-primary" />
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-foreground">{insights.totals.targets}</span>
              <Badge variant="secondary">Active</Badge>
            </div>
            <p>
              Targets tag assets into collections for scoping scans and reports. Add more to focus the live feed and stats
              breakdowns.
            </p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Knowledge base</CardDescription>
              <CardTitle className="text-2xl">Signals</CardTitle>
            </div>
            <BarChart3 className="h-10 w-10 text-primary" />
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-foreground">{techCount}</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">technologies tracked</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-foreground">{portCount}</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">open port buckets</span>
            </div>
            <p>
              Surfacing BBOT server stats directly from /assets/technologies/summarize and /assets/open_ports/list keeps the
              dashboard current without a proxy layer.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <TechnologyCard technologies={insights.technologies} />
        <OpenPortsCard ports={insights.open_ports} />
      </div>
    </section>
  );
}

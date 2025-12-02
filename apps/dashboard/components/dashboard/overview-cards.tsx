import { Activity, AlertTriangle, Gauge, Server } from "lucide-react";

import { type InsightResponse, type OverviewResponse } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface OverviewCardsProps {
  overview: OverviewResponse;
  insights: InsightResponse;
}

export function OverviewCards({ overview, insights }: OverviewCardsProps) {
  const topSeverity = Object.entries(insights.severity_breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const topCategories = Object.entries(insights.asset_categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="card-grid">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardDescription>Total assets</CardDescription>
            <CardTitle className="text-3xl">{overview.asset_count}</CardTitle>
          </div>
          <Server className="h-10 w-10 text-primary" />
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {topCategories.length ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-foreground">Top categories</p>
              <div className="flex flex-wrap gap-2">
                {topCategories.map(([category, count]) => (
                  <Badge key={category} variant="secondary">
                    {category} • {count}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No category metadata available.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardDescription>Recent events</CardDescription>
            <CardTitle className="text-3xl">{insights.totals.events}</CardTitle>
          </div>
          <Activity className="h-10 w-10 text-primary" />
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="text-sm">Streaming directly from /events/list</p>
          <p className="text-xs text-muted-foreground">Use it to monitor incoming scan results in real time.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardDescription>Severity mix</CardDescription>
            <CardTitle className="text-3xl">{topSeverity[0]?.[0] ?? "Unknown"}</CardTitle>
          </div>
          <AlertTriangle className="h-10 w-10 text-primary" />
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {topSeverity.length ? (
            topSeverity.map(([severity, count]) => (
              <div
                key={severity}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-foreground"
              >
                <span className="capitalize">{severity}</span>
                <Badge variant={severity === "critical" || severity === "high" ? "destructive" : "secondary"}>
                  {count}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No events yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Telemetry pulse</CardDescription>
          <CardTitle className="text-3xl">Live</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The dashboard now hits the BBOT REST API directly, reshaping the responses into quick UI snapshots.
          </p>
          <Separator />
          <div className="flex items-center gap-3">
            <Gauge className="h-6 w-6 text-primary" />
            <p className="text-foreground">Point it at your server via NEXT_PUBLIC_BBOT_API and NEXT_PUBLIC_BBOT_API_KEY.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

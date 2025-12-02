import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface KpiCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneToVariant = {
  default: "default",
  success: "success",
  warning: "warning",
  danger: "danger",
} as const;

export function KpiCard({ label, value, description, icon, tone = "default" }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <CardTitle className="text-3xl font-semibold text-foreground">{value}</CardTitle>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {icon ? <div className="rounded-full bg-white/5 p-3 text-primary">{icon}</div> : null}
      </CardHeader>
      <CardContent className="pt-0">
        <Badge variant={toneToVariant[tone]}>{tone === "default" ? "Healthy" : tone.toUpperCase()}</Badge>
      </CardContent>
    </Card>
  );
}

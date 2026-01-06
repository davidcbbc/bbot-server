import { CalendarClock, Radio } from "lucide-react";

import { formatDate, type EventRecord } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EventFeedProps {
  events: EventRecord[];
}

const severityToVariant: Record<string, "default" | "secondary" | "destructive"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
  info: "secondary"
};

export function EventFeed({ events }: EventFeedProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>Latest events</CardDescription>
        <CardTitle className="text-2xl">Alert stream</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Waiting on events… the stream updates as BBOT emits new data.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => {
              const severityKey = (event.severity ?? "info").toLowerCase();
              return (
                <li
                  key={event.id ?? `${event.message}-${event.created}`}
                  className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Radio className="h-4 w-4 text-primary" />
                      <span>{event.type ?? "generic"}</span>
                    </div>
                    <Badge variant={severityToVariant[severityKey] ?? "secondary"}>
                      {(event.severity ?? "info").toUpperCase()}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{event.message ?? "No description provided."}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarClock className="h-3 w-3" />
                    <span>{formatDate(event.created)}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

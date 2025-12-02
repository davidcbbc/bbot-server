import { AssetTable } from "@/components/dashboard/asset-table";
import { EventFeed } from "@/components/dashboard/event-feed";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { Button } from "@/components/ui/button";
import { loadDashboardData } from "@/lib/utils";

export default async function DashboardPage() {
  const { overview, insights } = await loadDashboardData();

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wider text-muted-foreground">BBOT Server</p>
          <h1 className="text-4xl font-bold tracking-tight">Command center</h1>
          <p className="text-muted-foreground">
            A Shadcn flavored Next.js dashboard that talks directly to the BBOT REST API.
          </p>
        </div>
        <Button asChild>
          <a href="https://github.com/blacklanternsecurity/bbot-server" target="_blank" rel="noreferrer">
            View API docs
          </a>
        </Button>
      </header>

      <OverviewCards overview={overview} insights={insights} />

      <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <AssetTable assets={overview.highlighted_assets} />
        <EventFeed events={overview.recent_events} />
      </section>
    </main>
  );
}

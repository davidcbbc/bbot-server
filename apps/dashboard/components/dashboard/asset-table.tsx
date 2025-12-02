import { type AssetRecord } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AssetTableProps {
  assets: AssetRecord[];
}

export function AssetTable({ assets }: AssetTableProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>Highlighted assets</CardDescription>
        <CardTitle className="text-2xl">Hosts & services</CardTitle>
      </CardHeader>
      <CardContent>
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hosts returned yet. Kick off a scan to see them appear.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Host</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id ?? asset.host}>
                  <TableCell className="font-medium">{asset.host ?? asset.name ?? "Unknown"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{asset.category ?? "uncategorized"}</TableCell>
                  <TableCell className="space-x-2">
                    {(asset.tags ?? []).length ? (
                      asset.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, Plus, Loader2, X, Check } from "lucide-react";
import { useState } from "react";
import type { JobMaterial } from "@shared/schema";

const statusColors: Record<string, string> = {
  needed: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  ordered: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  shipped: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  received: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  installed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

interface JobMaterialsListProps {
  jobId: string;
  canEdit: boolean;
}

export default function JobMaterialsList({ jobId, canEdit }: JobMaterialsListProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");

  const { data: materials = [], isLoading } = useQuery<JobMaterial[]>({
    queryKey: ['/api/jobs', jobId, 'materials'],
    queryFn: () => fetch(`/api/jobs/${jobId}/materials`, { credentials: 'include' }).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: async (data: { name: string; quantity: string }) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/materials`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'materials'] });
      setNewName("");
      setNewQty("1");
      setShowAdd(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/materials/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'materials'] });
    },
  });

  const nextStatus: Record<string, string> = {
    needed: "ordered",
    ordered: "shipped",
    shipped: "received",
    received: "installed",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between flex-wrap gap-1">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Materials
            {materials.length > 0 && (
              <Badge variant="secondary" className="text-xs">{materials.length}</Badge>
            )}
          </span>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAdd(!showAdd)}
            >
              {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Material name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  addMutation.mutate({ name: newName.trim(), quantity: newQty });
                }
              }}
            />
            <Input
              type="number"
              placeholder="Qty"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="w-16"
            />
            <Button
              size="icon"
              disabled={!newName.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate({ name: newName.trim(), quantity: newQty })}
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : materials.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No materials tracked yet</p>
            {canEdit && (
              <p className="text-xs mt-1">Tap + to add materials needed for this job</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {materials.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Qty: {m.quantity}{m.unit && m.unit !== 'each' ? ` ${m.unit}` : ''}
                    {m.supplier && ` · ${m.supplier}`}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={`text-xs shrink-0 ${statusColors[m.status || 'needed'] || ''} ${canEdit && nextStatus[m.status || 'needed'] ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (canEdit && m.status && nextStatus[m.status]) {
                      updateStatusMutation.mutate({ id: m.id, status: nextStatus[m.status] });
                    }
                  }}
                >
                  {m.status || 'needed'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

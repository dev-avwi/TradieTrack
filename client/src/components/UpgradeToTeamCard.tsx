import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppMode } from "@/hooks/use-app-mode";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Users, 
  MapPin, 
  Calendar, 
  MessageSquare,
  ArrowRight,
  CheckCircle,
  Sparkles
} from "lucide-react";

interface UpgradeToTeamCardProps {
  onNavigate?: (path: string) => void;
}

export default function UpgradeToTeamCard({ onNavigate }: UpgradeToTeamCardProps) {
  const { canUpgradeToTeam, refreshAppMode } = useAppMode();
  const { toast } = useToast();

  // Upgrade business settings to team mode
  const upgradeToTeam = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/business-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamSize: 'small' }),
      });
      if (!response.ok) {
        throw new Error('Failed to upgrade to team mode');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      refreshAppMode();
      toast({
        title: "Upgraded to Team Mode!",
        description: "You can now invite team members and access team features.",
      });
      // Navigate to team page to invite first member
      onNavigate?.('/team?invite=true');
    },
    onError: (error: Error) => {
      toast({
        title: "Upgrade failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!canUpgradeToTeam) {
    return null;
  }

  const teamFeatures = [
    { icon: Users, label: "Invite team members", description: "Add workers to your business" },
    { icon: Calendar, label: "Job scheduling", description: "Assign jobs with drag & drop" },
    { icon: MapPin, label: "Live location tracking", description: "See where your team is" },
    { icon: MessageSquare, label: "Team chat", description: "Communicate in real-time" },
  ];

  return (
    <Card className="border-2 border-dashed overflow-hidden" data-testid="upgrade-to-team-card">
      {/* Gradient header */}
      <div 
        className="h-2"
        style={{ 
          background: 'linear-gradient(90deg, hsl(var(--trade)), hsl(217.2 91.2% 59.8%))' 
        }}
      />
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            Ready to grow your business?
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            Upgrade
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Unlock team features to manage workers, track locations, and scale your operations.
        </p>

        {/* Feature list */}
        <div className="grid grid-cols-2 gap-3">
          {teamFeatures.map((feature, index) => (
            <div 
              key={index}
              className="flex items-start gap-2 p-2 rounded-lg bg-muted/50"
            >
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
              >
                <feature.icon className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{feature.label}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Upgrade button */}
        <Button
          className="w-full h-12 text-white font-semibold rounded-xl"
          style={{ 
            background: 'linear-gradient(90deg, hsl(var(--trade)), hsl(217.2 91.2% 59.8%))' 
          }}
          onClick={() => upgradeToTeam.mutate()}
          disabled={upgradeToTeam.isPending}
          data-testid="button-upgrade-to-team"
        >
          {upgradeToTeam.isPending ? (
            "Upgrading..."
          ) : (
            <>
              Upgrade to Team Mode
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Start with a free team member. Add more as your business grows.
        </p>
      </CardContent>
    </Card>
  );
}

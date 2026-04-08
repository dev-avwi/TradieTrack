import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { Link } from "wouter";
import {
  Crown,
  Zap,
  ArrowRight,
  Sparkles,
  Check,
} from "lucide-react";

export default function DashboardUpgradeCard() {
  const { subscriptionTier, isFoundingMember, isLoading } = useFeatureAccess();

  if (isLoading || isFoundingMember) {
    return null;
  }

  if (subscriptionTier !== 'free') {
    return null;
  }

  const highlights = [
    "Unlimited jobs & invoices",
    "AI-powered quoting",
    "Custom branding",
    "SMS reminders",
  ];

  return (
    <Card className="overflow-hidden" data-testid="dashboard-upgrade-card">
      <div
        className="h-1.5"
        style={{
          background: 'linear-gradient(90deg, hsl(var(--trade)), hsl(var(--primary)))',
        }}
      />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Upgrade to Pro</span>
          </div>
          <Badge variant="outline" className="text-xs">
            7-day free trial
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Unlock powerful tools to run your trade business more efficiently.
        </p>

        <div className="grid grid-cols-2 gap-1.5">
          {highlights.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              <span className="text-xs">{item}</span>
            </div>
          ))}
        </div>

        <Link href="/subscription">
          <Button className="w-full" size="sm">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Start Free Trial
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

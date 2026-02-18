import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Clock,
  Lightbulb,
  CheckCircle,
  ChevronRight,
  DollarSign,
  Calendar,
  Briefcase,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

interface ActionItem {
  id: string;
  priority: string;
  title: string;
  description: string;
  impact: string;
  cta: string;
  ctaUrl: string;
  metric: string;
  category: string;
}

interface ActionCenterData {
  actions: ActionItem[];
  summary: {
    fixNowCount: number;
    thisWeekCount: number;
    suggestionsCount: number;
    totalCount: number;
  };
  sections: {
    fix_now: ActionItem[];
    this_week: ActionItem[];
    suggestions: ActionItem[];
  };
}

interface ActionCenterProps {
  onNavigate?: (path: string) => void;
}

const categoryConfig: Record<string, { icon: typeof DollarSign; color: string }> = {
  revenue: { icon: DollarSign, color: "hsl(142.1 76.2% 36.3%)" },
  schedule: { icon: Calendar, color: "hsl(221.2 83.2% 53.3%)" },
  operations: { icon: Briefcase, color: "hsl(262.1 83.3% 57.8%)" },
};

const sectionConfig = [
  {
    key: "fix_now" as const,
    label: "Fix Now",
    countKey: "fixNowCount" as const,
    icon: AlertTriangle,
    dotColor: "hsl(var(--destructive))",
    bgColor: "hsl(var(--destructive) / 0.08)",
  },
  {
    key: "this_week" as const,
    label: "This Week",
    countKey: "thisWeekCount" as const,
    icon: Clock,
    dotColor: "hsl(38 92% 50%)",
    bgColor: "hsl(38 92% 50% / 0.08)",
  },
  {
    key: "suggestions" as const,
    label: "Suggestions",
    countKey: "suggestionsCount" as const,
    icon: Lightbulb,
    dotColor: "hsl(142.1 76.2% 36.3%)",
    bgColor: "hsl(142.1 76.2% 36.3% / 0.08)",
  },
];

function ActionCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            <div className="h-4 w-16 rounded-md bg-muted" />
            <div className="h-5 w-3/4 rounded-md bg-muted" />
            <div className="h-4 w-full rounded-md bg-muted" />
            <div className="h-4 w-1/2 rounded-md bg-muted" />
          </div>
          <div className="h-9 w-28 rounded-md bg-muted flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-6 w-32 rounded-md bg-muted animate-pulse" />
        <ActionCardSkeleton />
        <ActionCardSkeleton />
      </div>
      <div className="space-y-2">
        <div className="h-6 w-32 rounded-md bg-muted animate-pulse" />
        <ActionCardSkeleton />
      </div>
    </div>
  );
}

export default function ActionCenter({ onNavigate }: ActionCenterProps) {
  const [, setLocation] = useLocation();
  const navigate = onNavigate || setLocation;

  const { data, isLoading } = useQuery<ActionCenterData>({
    queryKey: ["/api/bi/action-center"],
  });

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getCategoryIcon = (category: string) => {
    const config = categoryConfig[category];
    if (!config) return Briefcase;
    return config.icon;
  };

  const getCategoryColor = (category: string) => {
    const config = categoryConfig[category];
    if (!config) return "hsl(var(--muted-foreground))";
    return config.color;
  };

  const isEmpty = data && data.summary.totalCount === 0;

  return (
    <div className="w-full px-4 sm:px-6 py-4 pb-28">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Action Center
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          What needs your attention
        </p>
      </div>

      {isLoading && <LoadingSkeleton />}

      {isEmpty && (
        <Card>
          <CardContent className="py-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: "hsl(142.1 76.2% 36.3% / 0.1)" }}
            >
              <CheckCircle
                className="h-6 w-6"
                style={{ color: "hsl(142.1 76.2% 36.3%)" }}
              />
            </div>
            <p className="text-base font-medium text-foreground mb-1">
              You're all caught up!
            </p>
            <p className="text-sm text-muted-foreground">
              No actions needed right now.
            </p>
          </CardContent>
        </Card>
      )}

      {data && !isEmpty && (
        <div className="space-y-4">
          {sectionConfig.map((section) => {
            const items = data.sections[section.key];
            const count = data.summary[section.countKey];
            if (!items || items.length === 0) return null;

            const isCollapsed = collapsed[section.key];
            const SectionIcon = section.icon;

            return (
              <div key={section.key} className="space-y-2">
                <button
                  className="flex items-center gap-2 w-full text-left py-1 group"
                  onClick={() => toggleSection(section.key)}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: section.bgColor }}
                  >
                    <SectionIcon
                      className="h-3.5 w-3.5"
                      style={{ color: section.dotColor }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {section.label}
                  </span>
                  <Badge variant="outline" className="no-default-hover-elevate text-xs">
                    {count}
                  </Badge>
                  <ChevronDown
                    className="h-4 w-4 text-muted-foreground ml-auto transition-transform"
                    style={{
                      transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    }}
                  />
                </button>

                {!isCollapsed && (
                  <div className="space-y-2">
                    {items.map((action) => {
                      const CategoryIcon = getCategoryIcon(action.category);
                      return (
                        <Card key={action.id} className="hover-elevate cursor-pointer" onClick={() => navigate(action.ctaUrl)}>
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <Badge variant="outline" className="no-default-hover-elevate text-xs gap-1">
                                  <CategoryIcon
                                    className="h-3 w-3"
                                    style={{ color: getCategoryColor(action.category) }}
                                  />
                                  {action.category}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  {action.title}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {action.description}
                                </p>
                              </div>
                              {action.impact && (
                                <p className="text-xs text-muted-foreground">
                                  {action.metric && (
                                    <span
                                      className="font-semibold text-foreground"
                                    >
                                      {action.metric}
                                    </span>
                                  )}{" "}
                                  {action.impact}
                                </p>
                              )}
                              <div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(action.ctaUrl);
                                  }}
                                >
                                  {action.cta}
                                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

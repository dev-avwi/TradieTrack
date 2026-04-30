import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Users, Plus, Filter, Sparkles, ArrowUpRight, MoreHorizontal,
  ChevronDown, Mail, ArrowRight, UserPlus, Link2, ShieldCheck,
  Search, Loader2, Lock, Crown, AlertCircle, MessageSquare,
  Phone, MapPin, Clock, CheckCircle2, RefreshCw, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useFeatureAccess } from "@/hooks/use-subscription";
import SendMagicLinkSheet from "@/components/subs/SendMagicLinkSheet";

type TabKey = "members" | "subcontractors";
type SubFilter = "all" | "active" | "pending" | "off" | "inactive";

interface TeamMember {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
  invitationStatus?: string;
  lastActiveAt?: string | null;
  hoursThisWeek?: number;
  avatarUrl?: string | null;
  initials?: string;
}

interface SubcontractorRow {
  id: string;
  kind: "magic_link" | "account_sub" | "connected_business";
  name: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  status: string;
  lastActivity?: string | null;
  jobsCount?: number;
  trade?: string | null;
  businessName?: string | null;
}

function initialsFor(first?: string, last?: string, fallback?: string) {
  const a = (first || "").trim();
  const b = (last || "").trim();
  if (a || b) return `${a[0] || ""}${b[0] || ""}`.toUpperCase() || "?";
  if (fallback) {
    const parts = fallback.trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  }
  return "?";
}

function colorFromString(s: string) {
  const palette = [
    "hsl(217 91% 53%)",
    "hsl(145 65% 42%)",
    "hsl(35 90% 50%)",
    "hsl(280 55% 58%)",
    "hsl(10 80% 58%)",
    "hsl(195 70% 48%)",
  ];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function timeAgo(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 0) return "—";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function MiniSpark({ color = "hsl(217 91% 53%)" }: { color?: string }) {
  return (
    <svg viewBox="0 0 60 24" className="w-14 h-5">
      <polyline
        points="0,18 10,14 20,16 30,8 40,11 50,5 60,7"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({
  label, value, delta, deltaPositive, sparkColor,
}: { label: string; value: string | number; delta?: string; deltaPositive?: boolean; sparkColor?: string }) {
  return (
    <Card className="flex-1 min-w-[180px]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
          {delta && (
            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${deltaPositive ? "text-success" : "text-muted-foreground"}`}>
              <ArrowUpRight className="w-2.5 h-2.5" />{delta}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <div className="text-[26px] font-bold tracking-tight tabular-nums">{value}</div>
          <MiniSpark color={sparkColor} />
        </div>
      </CardContent>
    </Card>
  );
}

function PlanLockOverlay({ onUpgrade, message }: { onUpgrade: () => void; message: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/85 backdrop-blur-sm rounded-md">
      <Card className="max-w-md w-[90%] mx-auto">
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-warning/10 flex items-center justify-center mb-3">
            <Crown className="w-6 h-6 text-warning" />
          </div>
          <h3 className="text-base font-semibold mb-1">Team Plan required</h3>
          <p className="text-sm text-muted-foreground mb-4">{message}</p>
          <Button onClick={onUpgrade} data-testid="button-upgrade-from-team-page">
            Upgrade to Team — $29/seat
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeamPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { subscriptionTier, canAddTeamMembers } = useFeatureAccess();
  const [tab, setTab] = useState<TabKey>("members");
  const [filter, setFilter] = useState<SubFilter>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [sendLinkOpen, setSendLinkOpen] = useState(false);
  const [inviteMemberOpen, setInviteMemberOpen] = useState(false);
  const [inviteAccountSubOpen, setInviteAccountSubOpen] = useState(false);

  const isFree = subscriptionTier === "free";
  const isPro = subscriptionTier === "pro" || subscriptionTier === "trial";
  const hasTeamPlan = canAddTeamMembers;

  const membersQuery = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members"],
    enabled: hasTeamPlan,
  });

  const subsQuery = useQuery<SubcontractorRow[]>({
    queryKey: ["/api/subcontractors"],
  });

  const members = membersQuery.data ?? [];
  const subs = subsQuery.data ?? [];

  const filteredMembers = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === "active" && (m.status === "off_today" || m.invitationStatus === "pending")) return false;
      if (filter === "pending" && m.invitationStatus !== "pending") return false;
      if (filter === "off" && m.status !== "off_today") return false;
      if (filter === "inactive" && m.status !== "inactive") return false;
      if (!lower) return true;
      const hay = `${m.firstName || ""} ${m.lastName || ""} ${m.email || ""} ${m.role || ""}`.toLowerCase();
      return hay.includes(lower);
    });
  }, [members, filter, search]);

  const filteredSubs = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return subs.filter((s) => {
      if (filter === "active" && s.status !== "active" && s.status !== "accepted") return false;
      if (filter === "pending" && s.status !== "pending") return false;
      if (filter === "inactive" && s.status !== "revoked" && s.status !== "expired") return false;
      if (filter === "off") return false;
      if (!lower) return true;
      const hay = `${s.name} ${s.contactPhone || ""} ${s.contactEmail || ""} ${s.trade || ""}`.toLowerCase();
      return hay.includes(lower);
    });
  }, [subs, filter, search]);

  const stats = useMemo(() => {
    const activeMembers = members.filter((m) => m.invitationStatus !== "pending" && m.status !== "inactive").length;
    const pendingMembers = members.filter((m) => m.invitationStatus === "pending").length;
    const totalSubs = subs.length;
    const hours = members.reduce((acc, m) => acc + (m.hoursThisWeek || 0), 0);
    return { activeMembers, pendingMembers, totalSubs, hours };
  }, [members, subs]);

  const filterCounts = useMemo(() => {
    if (tab === "members") {
      return {
        all: members.length,
        active: members.filter((m) => m.invitationStatus !== "pending" && m.status !== "off_today" && m.status !== "inactive").length,
        pending: members.filter((m) => m.invitationStatus === "pending").length,
        off: members.filter((m) => m.status === "off_today").length,
        inactive: members.filter((m) => m.status === "inactive").length,
      };
    }
    return {
      all: subs.length,
      active: subs.filter((s) => s.status === "active" || s.status === "accepted").length,
      pending: subs.filter((s) => s.status === "pending").length,
      off: 0,
      inactive: subs.filter((s) => s.status === "revoked" || s.status === "expired").length,
    };
  }, [tab, members, subs]);

  const handleAddChoice = (kind: "member" | "magic_link" | "account_sub") => {
    setAddOpen(false);
    if (kind === "member") {
      if (!hasTeamPlan) {
        toast({
          title: "Team Plan needed",
          description: "Inviting members needs a Team plan ($29/seat). Upgrading now.",
        });
        setLocation("/pricing");
        return;
      }
      setInviteMemberOpen(true);
    } else if (kind === "magic_link") {
      if (isFree) {
        toast({ title: "Pro plan needed", description: "Magic-link subs are on Pro and above." });
        setLocation("/pricing");
        return;
      }
      setSendLinkOpen(true);
    } else {
      if (!hasTeamPlan) {
        toast({ title: "Team Plan needed", description: "Account subs need a Team plan." });
        setLocation("/pricing");
        return;
      }
      setInviteAccountSubOpen(true);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto" data-testid="page-team">
      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-12 max-w-[1400px] mx-auto">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-team-title">Team</h1>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-success/10 text-success flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-success animate-pulse" />
                {stats.activeMembers + stats.totalSubs} active
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Members, subcontractors and access — everything in one place.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" data-testid="button-team-filters">
              <Filter className="w-3.5 h-3.5" /> Filters
            </Button>
            <Button variant="outline" size="sm" data-testid="button-team-insights">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Insights
            </Button>
            <DropdownMenu open={addOpen} onOpenChange={setAddOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" data-testid="button-team-add">
                  <Plus className="w-3.5 h-3.5" /> Add
                  <ChevronDown className="w-3 h-3 opacity-70 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-2">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                  Add to your team
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="flex items-start gap-3 p-2.5 rounded-md cursor-pointer"
                  onClick={() => handleAddChoice("member")}
                  data-testid="add-choice-member"
                >
                  <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">Invite member</div>
                    <div className="text-[11.5px] text-muted-foreground leading-relaxed">
                      Permanent staff with email login & role-based access.
                    </div>
                    <Badge variant="secondary" className="mt-1 text-[10px]">Team Plan · $29/seat</Badge>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-start gap-3 p-2.5 rounded-md cursor-pointer"
                  onClick={() => handleAddChoice("magic_link")}
                  data-testid="add-choice-magic-link"
                >
                  <div className="w-9 h-9 rounded-md bg-purple-500/10 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">Magic-link sub</div>
                    <div className="text-[11.5px] text-muted-foreground leading-relaxed">
                      One-job access via SMS — no app, no account needed.
                    </div>
                    <Badge variant="secondary" className="mt-1 text-[10px]">Pro+ · Free</Badge>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-start gap-3 p-2.5 rounded-md cursor-pointer"
                  onClick={() => handleAddChoice("account_sub")}
                  data-testid="add-choice-account-sub"
                >
                  <div className="w-9 h-9 rounded-md bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">Account subcontractor</div>
                    <div className="text-[11.5px] text-muted-foreground leading-relaxed">
                      Recurring sub with their own dashboard & invoicing.
                    </div>
                    <Badge variant="secondary" className="mt-1 text-[10px]">Team Plan · $29/seat</Badge>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stat cards */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <StatCard label="Active members" value={hasTeamPlan ? stats.activeMembers : 0} delta={hasTeamPlan ? `${stats.activeMembers} on payroll` : "Locked"} deltaPositive />
          <StatCard label="Pending invites" value={hasTeamPlan ? stats.pendingMembers : 0} delta={stats.pendingMembers > 0 ? "Awaiting accept" : "All caught up"} sparkColor="hsl(35 90% 50%)" />
          <StatCard label="Subcontractors" value={stats.totalSubs} delta="Magic-link + account" deltaPositive sparkColor="hsl(280 55% 58%)" />
          <StatCard label="Hours this week" value={`${stats.hours}h`} delta={stats.hours > 0 ? "Across team" : "—"} deltaPositive sparkColor="hsl(145 65% 42%)" />
        </div>

        {/* Tabs */}
        <div className="border-b flex items-center flex-wrap gap-y-1">
          {([
            ["members", "Members", filterCounts.all, Users, hasTeamPlan ? members.length : 0],
            ["subcontractors", "Subcontractors", subs.length, Link2, subs.length],
          ] as const).map(([key, label, _, Icon, count]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => { setTab(key as TabKey); setFilter("all"); }}
                data-testid={`tab-${key}`}
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                  active ? "text-foreground border-foreground" : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                <span className={`text-[10.5px] font-medium px-1.5 py-px rounded ${active ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-1 pb-1.5">
            <Button variant="ghost" size="sm" className="text-[12px] text-muted-foreground" data-testid="button-roles-permissions">
              Roles & permissions
            </Button>
            <Button variant="ghost" size="sm" className="text-[12px] text-muted-foreground" data-testid="button-activity-log">
              Activity log
            </Button>
          </div>
        </div>

        {/* Sub-filters + search */}
        <div className="flex items-center gap-2 py-3.5 flex-wrap">
          {([
            ["all", "All", filterCounts.all],
            ["active", "Active", filterCounts.active],
            ["pending", "Pending", filterCounts.pending],
            ...(tab === "members" ? [["off", "On time off", filterCounts.off] as const] : []),
            ["inactive", "Inactive", filterCounts.inactive],
          ] as const).map(([key, label, count]) => {
            const active = filter === key;
            return (
              <Button
                key={key}
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(key as SubFilter)}
                data-testid={`filter-${key}`}
                className="h-7"
              >
                {label} <span className={`text-[10px] ml-1 ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{count}</span>
              </Button>
            );
          })}
          <div className="relative ml-auto">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team or subs…"
              className="h-8 w-64 pl-8 text-[12.5px]"
              data-testid="input-team-search"
            />
          </div>
        </div>

        {/* Tab content */}
        <div className="relative">
          {tab === "members" && !hasTeamPlan && (
            <PlanLockOverlay
              onUpgrade={() => setLocation("/pricing")}
              message={isPro
                ? "You're on Pro (single user). Upgrade to Team to invite staff at $29/seat."
                : "Inviting team members requires a Team plan. Subs are still available on Pro."
              }
            />
          )}

          {tab === "members" ? (
            <MembersTable
              members={filteredMembers}
              loading={membersQuery.isLoading && hasTeamPlan}
              showLockedSample={!hasTeamPlan}
            />
          ) : (
            <SubcontractorsTable
              rows={filteredSubs}
              loading={subsQuery.isLoading}
              onSendNew={() => handleAddChoice("magic_link")}
            />
          )}
        </div>

        {/* Below-the-fold add-chooser tiles (always-visible, plan-aware) */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <AddTile
            icon={UserPlus}
            iconColor="hsl(217 91% 53%)"
            title="Invite member"
            desc="Permanent staff with email login & role-based access."
            tag={hasTeamPlan ? "Team Plan" : "Upgrade required"}
            tagColor={hasTeamPlan ? "hsl(217 91% 53%)" : "hsl(35 90% 50%)"}
            locked={!hasTeamPlan}
            onClick={() => handleAddChoice("member")}
            testId="tile-invite-member"
          />
          <AddTile
            icon={Link2}
            iconColor="hsl(280 55% 58%)"
            title="Magic-link sub"
            desc="One-job access via SMS — no app, no account needed. Free for the sub."
            tag={isFree ? "Pro+ required" : "Free with Pro+"}
            tagColor="hsl(280 55% 58%)"
            locked={isFree}
            onClick={() => handleAddChoice("magic_link")}
            testId="tile-magic-link"
          />
          <AddTile
            icon={ShieldCheck}
            iconColor="hsl(145 65% 42%)"
            title="Account subcontractor"
            desc="Recurring sub with their own dashboard, invoicing, and history."
            tag={hasTeamPlan ? "$29/seat" : "Team Plan needed"}
            tagColor={hasTeamPlan ? "hsl(145 65% 42%)" : "hsl(35 90% 50%)"}
            locked={!hasTeamPlan}
            onClick={() => handleAddChoice("account_sub")}
            testId="tile-account-sub"
          />
        </div>
      </div>

      {/* Send Magic Link Sheet */}
      <SendMagicLinkSheet
        open={sendLinkOpen}
        onOpenChange={setSendLinkOpen}
        onSent={() => {
          subsQuery.refetch();
        }}
      />

      {/* Invite Member Sheet (defers to existing invite flow) */}
      <Sheet open={inviteMemberOpen} onOpenChange={setInviteMemberOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Invite a team member</SheetTitle>
            <SheetDescription>
              Permanent staff with email login & role-based access. $29/seat per month.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Member invitations are now handled in the team admin flow. We'll redirect you there.
            </p>
            <Button
              className="w-full"
              onClick={() => { setInviteMemberOpen(false); setLocation("/team-operations"); }}
              data-testid="button-go-to-invite-flow"
            >
              Open invite flow
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Account Sub Invite Sheet (placeholder — same redirect for now) */}
      <Sheet open={inviteAccountSubOpen} onOpenChange={setInviteAccountSubOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add an account subcontractor</SheetTitle>
            <SheetDescription>
              Invite a sub who'll have their own dashboard and can submit invoices to you.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Account subs use the standard team-invite flow with role <b>Subcontractor</b>.
            </p>
            <Button
              className="w-full"
              onClick={() => { setInviteAccountSubOpen(false); setLocation("/team-operations"); }}
              data-testid="button-go-to-account-sub-flow"
            >
              Open invite flow
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AddTile({
  icon: Icon, iconColor, title, desc, tag, tagColor, locked, onClick, testId,
}: {
  icon: any; iconColor: string; title: string; desc: string;
  tag: string; tagColor: string; locked: boolean; onClick: () => void; testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="group text-left p-4 bg-card rounded-md border hover-elevate active-elevate-2 transition-colors relative"
    >
      <div className="flex items-start justify-between mb-2.5 gap-2">
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in oklch, ${iconColor} 12%, transparent)`, color: iconColor }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1"
          style={{ background: `color-mix(in oklch, ${tagColor} 12%, transparent)`, color: tagColor }}
        >
          {locked && <Lock className="w-2.5 h-2.5" />}
          {tag}
        </span>
      </div>
      <div className="text-[13.5px] font-semibold mb-0.5">{title}</div>
      <div className="text-[12px] text-muted-foreground leading-relaxed">{desc}</div>
    </button>
  );
}

function MembersTable({
  members, loading, showLockedSample,
}: { members: TeamMember[]; loading: boolean; showLockedSample: boolean }) {
  const sample: TeamMember[] = showLockedSample ? [
    { id: "s1", firstName: "Sarah", lastName: "Chen", role: "manager", status: "active", invitationStatus: "accepted", lastActiveAt: new Date(Date.now() - 120000).toISOString(), hoursThisWeek: 38 },
    { id: "s2", firstName: "Marcus", lastName: "Johnson", role: "tradie", status: "active", invitationStatus: "accepted", lastActiveAt: new Date().toISOString(), hoursThisWeek: 42 },
    { id: "s3", firstName: "Tom", lastName: "Reilly", role: "tradie", status: "off_today", invitationStatus: "accepted", lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString(), hoursThisWeek: 0 },
  ] : [];

  const rows = showLockedSample ? sample : members;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <h3 className="font-semibold text-base mb-1">No team members yet</h3>
          <p className="text-sm text-muted-foreground">Invite your first team member to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px_44px] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b">
        <div>Member</div>
        <div>Role</div>
        <div>Status</div>
        <div>Last active</div>
        <div>Hours / wk</div>
        <div></div>
      </div>
      {rows.map((m) => {
        const name = `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown";
        const status = m.invitationStatus === "pending" ? "pending" : m.status === "off_today" ? "away" : m.status === "inactive" ? "inactive" : "on";
        const init = initialsFor(m.firstName, m.lastName);
        const color = colorFromString(m.id || name);

        return (
          <div
            key={m.id}
            data-testid={`row-member-${m.id}`}
            className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px_44px] px-4 py-3 items-center text-[13px] border-b last:border-0 hover-elevate group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full text-white text-[11px] font-semibold flex items-center justify-center" style={{ background: color }}>
                  {init}
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-background ${
                  status === "on" ? "bg-success" : status === "away" ? "bg-purple-500" : status === "pending" ? "bg-warning" : "bg-muted-foreground"
                }`} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{name}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">{m.email || m.phone || `@${(m.firstName || "user").toLowerCase()}`}</div>
              </div>
            </div>
            <div>
              <Badge variant="secondary" className="text-[11px] capitalize">{m.role || "member"}</Badge>
            </div>
            <div className="text-[11.5px] font-medium flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === "on" ? "bg-success" : status === "away" ? "bg-purple-500" : status === "pending" ? "bg-warning" : "bg-muted-foreground"
              }`} />
              <span className={
                status === "on" ? "text-success" : status === "away" ? "text-purple-600" : status === "pending" ? "text-warning" : "text-muted-foreground"
              }>
                {status === "on" ? "Active" : status === "away" ? "On time off" : status === "pending" ? "Pending" : "Inactive"}
              </span>
            </div>
            <div className="text-[12.5px] text-muted-foreground tabular-nums">{timeAgo(m.lastActiveAt)}</div>
            <div className="text-[12.5px] tabular-nums font-medium">{m.hoursThisWeek ? `${m.hoursThisWeek}h` : "—"}</div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function SubcontractorsTable({
  rows, loading, onSendNew,
}: { rows: SubcontractorRow[]; loading: boolean; onSendNew: () => void }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Link2 className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <h3 className="font-semibold text-base mb-1">No subcontractors yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Send a magic-link to a sub for instant one-job access — no app required.</p>
          <Button onClick={onSendNew} data-testid="button-send-first-link">
            <Link2 className="w-4 h-4" /> Send first magic link
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px_44px] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b">
        <div>Subcontractor</div>
        <div>Type</div>
        <div>Status</div>
        <div>Last activity</div>
        <div>Jobs</div>
        <div></div>
      </div>
      {rows.map((s) => {
        const init = initialsFor(undefined, undefined, s.name);
        const color = colorFromString(s.id);
        const kindLabel = s.kind === "magic_link" ? "Magic link" : s.kind === "account_sub" ? "Account" : "Connected";
        const kindColor = s.kind === "magic_link" ? "hsl(280 55% 58%)" : s.kind === "account_sub" ? "hsl(145 65% 42%)" : "hsl(217 91% 53%)";

        return (
          <div
            key={s.id}
            data-testid={`row-sub-${s.id}`}
            className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px_44px] px-4 py-3 items-center text-[13px] border-b last:border-0 hover-elevate group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0" style={{ background: color }}>
                {init}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{s.name}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">
                  {s.contactPhone || s.contactEmail || s.businessName || s.trade || "—"}
                </div>
              </div>
            </div>
            <div>
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1"
                style={{ background: `color-mix(in oklch, ${kindColor} 12%, transparent)`, color: kindColor }}
              >
                {s.kind === "magic_link" ? <Link2 className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                {kindLabel}
              </span>
            </div>
            <div className="text-[11.5px] font-medium flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                s.status === "active" || s.status === "accepted" ? "bg-success" :
                s.status === "pending" ? "bg-warning" :
                s.status === "revoked" || s.status === "expired" ? "bg-destructive" : "bg-muted-foreground"
              }`} />
              <span className="capitalize">{s.status}</span>
            </div>
            <div className="text-[12.5px] text-muted-foreground tabular-nums">{timeAgo(s.lastActivity)}</div>
            <div className="text-[12.5px] tabular-nums font-medium">{s.jobsCount ?? 0}</div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

import './_group.css';
import {
  Users, Calendar, Clock, MessageCircle, LayoutDashboard,
  Briefcase, FileText, Settings, BarChart3, Map, DollarSign, Bot, LineChart,
  UserPlus, Search, MoreHorizontal, ChevronDown, Plus, Bell, HelpCircle,
  Camera, Receipt, ArrowUpRight, Link2, Mail, ShieldCheck, CheckCircle2,
  Sparkles, Filter, Send, Zap, ArrowRight
} from "lucide-react";

function NavItem({ icon: Icon, label, active, badge }: any) {
  return (
    <div
      className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors ${
        active ? 'bg-white text-[hsl(217_33%_17%)] shadow-[0_1px_0_0_rgba(16,24,40,0.04)] ring-1 ring-[hsl(217_12%_88%)]' : 'text-[hsl(217_20%_30%)] hover:bg-white/60'
      }`}
    >
      <Icon className={`w-[15px] h-[15px] flex-shrink-0 ${active ? 'text-[hsl(217_91%_53%)]' : 'text-[hsl(217_10%_46%)]'}`} />
      <span className="flex-1 truncate font-medium">{label}</span>
      {badge && (
        <span className={`ml-auto text-[10px] px-1.5 rounded-full font-semibold ${
          typeof badge === 'number' ? 'bg-[hsl(5_85%_55%)] text-white' : 'bg-[hsl(217_91%_53%/0.1)] text-[hsl(217_91%_53%)]'
        }`}>
          {badge}
        </span>
      )}
    </div>
  );
}

function StatCard({ label, value, delta, deltaPositive, sparkline }: any) {
  return (
    <div className="stat-card flex-1 bg-white rounded-lg border border-[hsl(217_12%_88%)] p-4 premium-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wider text-[hsl(217_10%_46%)] font-semibold">{label}</div>
        {delta && (
          <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${deltaPositive ? 'text-[hsl(145_65%_30%)]' : 'text-[hsl(217_10%_46%)]'}`}>
            <ArrowUpRight className="w-2.5 h-2.5" />{delta}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <div className="text-[26px] font-bold tracking-tight tabular-nums">{value}</div>
        {sparkline}
      </div>
    </div>
  );
}

function MiniSpark({ color = 'hsl(217 91% 53%)' }: any) {
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

export function Proposed() {
  return (
    <div className="team-redesign-root min-h-screen flex bg-[hsl(210_40%_98%)] text-[hsl(217_33%_17%)]">
      {/* Sidebar — clean, single Team entry */}
      <aside className="w-[244px] bg-[hsl(217_15%_94%)] border-r border-[hsl(217_12%_86%)] flex flex-col">
        <div className="px-3 py-3 border-b border-[hsl(217_12%_86%)] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[hsl(217_91%_53%)] to-[hsl(217_91%_43%)] flex items-center justify-center text-white text-xs font-bold">JR</div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">Vogler Plumbing</div>
            <div className="text-[10.5px] text-[hsl(217_10%_46%)] flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-[hsl(145_65%_42%)]" />
              Team Plan · 11 seats
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-[hsl(217_10%_46%)] px-2.5 py-1.5 mt-1 font-semibold">Workspace</div>
          <NavItem icon={LayoutDashboard} label="Dashboard" />
          <NavItem icon={Briefcase} label="Jobs" />
          <NavItem icon={FileText} label="Quotes & Invoices" />
          <NavItem icon={Users} label="Customers" />
          <NavItem icon={Calendar} label="Schedule" />
          <NavItem icon={Clock} label="Time Tracking" />

          {/* Single, premium "Team" entry replaces 5 cluttered ones */}
          <div className="relative">
            <NavItem icon={Users} label="Team" active badge="11" />
            <div className="absolute -right-1 -top-1 px-1.5 py-px bg-[hsl(145_65%_42%)] text-white text-[8px] font-bold uppercase tracking-wider rounded-full shadow-sm">
              Unified
            </div>
          </div>

          <NavItem icon={MessageCircle} label="Chat" badge={12} />
          <NavItem icon={Map} label="Map" />
          <NavItem icon={LineChart} label="Insights" />
          <NavItem icon={DollarSign} label="Payroll" />
          <NavItem icon={Bot} label="Autopilot" />
          <NavItem icon={BarChart3} label="Reports" />
          <NavItem icon={Camera} label="Photos" />
          <NavItem icon={Receipt} label="Expenses" />

          <div className="text-[10px] uppercase tracking-wider text-[hsl(217_10%_46%)] px-2.5 py-1.5 mt-2 font-semibold">Account</div>
          <NavItem icon={Settings} label="Settings" />
        </div>

        <div className="border-t border-[hsl(217_12%_86%)] p-2.5">
          <div className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-white/60 cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(217_91%_53%)] to-[hsl(280_55%_58%)] text-white text-[11px] font-semibold flex items-center justify-center">AV</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold truncate">Ayden Vogler</div>
              <div className="text-[10.5px] text-[hsl(217_10%_46%)] truncate">Owner</div>
            </div>
            <MoreHorizontal className="w-3.5 h-3.5 text-[hsl(217_10%_46%)]" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-[hsl(217_12%_88%)] flex items-center px-6 gap-3">
          <div className="flex items-center gap-1.5 text-[12.5px] text-[hsl(217_10%_46%)]">
            <span>Workspace</span>
            <span className="text-[hsl(217_12%_75%)]">/</span>
            <span className="text-[hsl(217_33%_17%)] font-medium">Team</span>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(217_10%_46%)]" />
            <input className="h-8 w-72 pl-8 pr-12 rounded-md border border-[hsl(217_12%_88%)] bg-[hsl(210_40%_98%)] text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[hsl(217_91%_53%/0.2)]" placeholder="Search or jump to…" />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-px rounded border border-[hsl(217_12%_88%)] bg-white text-[hsl(217_10%_46%)]">⌘K</kbd>
          </div>
          <button className="p-1.5 rounded-md hover:bg-[hsl(217_6%_93%)] relative">
            <Bell className="w-4 h-4 text-[hsl(217_20%_30%)]" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[hsl(5_85%_55%)]" />
          </button>
          <button className="p-1.5 rounded-md hover:bg-[hsl(217_6%_93%)]"><HelpCircle className="w-4 h-4 text-[hsl(217_20%_30%)]" /></button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="px-7 pt-6 pb-4">
            {/* Page header */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-[24px] font-bold tracking-tight">Team</h1>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-[hsl(145_65%_42%/0.1)] text-[hsl(145_65%_30%)] flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[hsl(145_65%_42%)] pulse-dot" />
                    8 active now
                  </span>
                </div>
                <p className="text-[13px] text-[hsl(217_10%_46%)] mt-1">
                  Members, subcontractors and access — everything in one place.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="h-8 px-2.5 rounded-md border border-[hsl(217_12%_88%)] bg-white text-[12.5px] font-medium flex items-center gap-1.5 hover:bg-[hsl(217_6%_93%)]">
                  <Filter className="w-3.5 h-3.5" /> Filters
                </button>
                <button className="h-8 px-2.5 rounded-md border border-[hsl(217_12%_88%)] bg-white text-[12.5px] font-medium flex items-center gap-1.5 hover:bg-[hsl(217_6%_93%)]">
                  <Sparkles className="w-3.5 h-3.5 text-[hsl(280_55%_58%)]" /> Insights
                </button>
                <button className="h-8 pl-2.5 pr-2 rounded-md bg-[hsl(217_33%_17%)] text-white text-[12.5px] font-semibold flex items-center gap-1.5 shadow-sm hover:bg-[hsl(217_33%_22%)]">
                  <Plus className="w-3.5 h-3.5" /> Add
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>
              </div>
            </div>

            {/* Stat strip */}
            <div className="flex gap-3 mb-6">
              <StatCard label="Active members" value="11" delta="+2 this month" deltaPositive sparkline={<MiniSpark />} />
              <StatCard label="Pending invites" value="4" delta="2 expiring soon" sparkline={<MiniSpark color="hsl(35 90% 50%)" />} />
              <StatCard label="Subcontractors" value="7" delta="+1 this week" deltaPositive sparkline={<MiniSpark color="hsl(280 55% 58%)" />} />
              <StatCard label="Hours this week" value="312h" delta="vs 287h" deltaPositive sparkline={<MiniSpark color="hsl(145 65% 42%)" />} />
            </div>

            {/* Tabs — only 2 main tabs */}
            <div className="border-b border-[hsl(217_12%_88%)] flex items-center gap-0">
              {[
                ["Members", true, "11", Users],
                ["Subcontractors", false, "7", Link2],
              ].map(([label, active, count, Icon]: any) => (
                <button
                  key={label}
                  data-tab-active={active ? "true" : "false"}
                  className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                    active ? 'text-[hsl(217_33%_17%)] border-[hsl(217_33%_17%)]' : 'text-[hsl(217_10%_46%)] border-transparent hover:text-[hsl(217_33%_17%)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  <span className={`text-[10.5px] font-medium px-1.5 py-px rounded ${active ? 'bg-[hsl(217_33%_17%/0.08)] text-[hsl(217_33%_17%)]' : 'bg-[hsl(217_6%_93%)] text-[hsl(217_10%_46%)]'}`}>{count}</span>
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1 pb-1.5">
                <button className="text-[12px] text-[hsl(217_10%_46%)] hover:text-[hsl(217_33%_17%)] px-2 py-1 rounded">Roles & permissions</button>
                <button className="text-[12px] text-[hsl(217_10%_46%)] hover:text-[hsl(217_33%_17%)] px-2 py-1 rounded">Activity log</button>
              </div>
            </div>

            {/* Sub-filter row */}
            <div className="flex items-center gap-2 py-3.5 flex-wrap">
              {[
                ["All", true, "11"],
                ["Active", false, "8"],
                ["Pending", false, "4"],
                ["On time off", false, "1"],
                ["Inactive", false, "0"],
              ].map(([label, active, count]: any) => (
                <button
                  key={label}
                  className={`h-7 px-2.5 rounded-md text-[12px] font-medium flex items-center gap-1.5 ${
                    active ? 'bg-[hsl(217_33%_17%)] text-white' : 'bg-white border border-[hsl(217_12%_88%)] text-[hsl(217_20%_30%)] hover:bg-[hsl(217_6%_93%)]'
                  }`}
                >
                  {label} <span className={`text-[10px] ${active ? 'text-white/70' : 'text-[hsl(217_10%_46%)]'}`}>{count}</span>
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <div className="text-[11.5px] text-[hsl(217_10%_46%)]">Sort by</div>
                <button className="h-7 px-2 rounded-md text-[12px] bg-white border border-[hsl(217_12%_88%)] flex items-center gap-1 hover:bg-[hsl(217_6%_93%)]">
                  Recently active <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </div>
            </div>

            {/* Premium table */}
            <div className="bg-white rounded-lg border border-[hsl(217_12%_88%)] overflow-hidden premium-shadow">
              <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px_44px] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-[hsl(217_10%_46%)] bg-[hsl(210_40%_98%)] border-b border-[hsl(217_12%_88%)]">
                <div>Member</div>
                <div>Role</div>
                <div>Status</div>
                <div>Last active</div>
                <div>Hours / wk</div>
                <div></div>
              </div>

              {[
                {n:"Sarah Chen", h:"@sarah · Manager", role:"Manager", roleColor:"hsl(217 91% 53%)", status:"Active", statusKind:"on", last:"2 min ago", hours:"38h", init:"SC", color:"hsl(217 91% 53%)"},
                {n:"Marcus Johnson", h:"@marcus · Lead Tradie", role:"Tradie", roleColor:"hsl(145 65% 42%)", status:"On a job", statusKind:"on", last:"Live now", hours:"42h", init:"MJ", color:"hsl(145 65% 42%)"},
                {n:"Priya Patel", h:"Invited 2 days ago", role:"Office Admin", roleColor:"hsl(35 90% 50%)", status:"Pending", statusKind:"pending", last:"—", hours:"—", init:"PP", color:"hsl(35 90% 50%)"},
                {n:"Tom Reilly", h:"@tom · Tradie", role:"Tradie", roleColor:"hsl(145 65% 42%)", status:"On time off", statusKind:"away", last:"3 days ago", hours:"0h", init:"TR", color:"hsl(280 55% 58%)"},
                {n:"Liam Cox", h:"@liam · Apprentice", role:"Tradie", roleColor:"hsl(145 65% 42%)", status:"Active", statusKind:"on", last:"18 min ago", hours:"36h", init:"LC", color:"hsl(10 80% 58%)"},
              ].map((m) => (
                <div key={m.n} className="grid grid-cols-[1.6fr_1fr_1fr_1fr_120px_44px] px-4 py-3 items-center text-[13px] border-b border-[hsl(217_12%_91%)] last:border-0 hover-row group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full text-white text-[11px] font-semibold flex items-center justify-center" style={{ background: m.color }}>{m.init}</div>
                      {m.statusKind === "on" && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[hsl(145_65%_42%)] ring-2 ring-white" />}
                      {m.statusKind === "away" && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[hsl(280_55%_58%)] ring-2 ring-white" />}
                      {m.statusKind === "pending" && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[hsl(35_90%_50%)] ring-2 ring-white" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[13px] truncate">{m.n}</div>
                      <div className="text-[11.5px] text-[hsl(217_10%_46%)] truncate">{m.h}</div>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11.5px] font-medium px-2 py-0.5 rounded" style={{ background: `hsl(from ${m.roleColor} h s l / 0.1)`, color: m.roleColor }}>
                      {m.role}
                    </span>
                  </div>
                  <div>
                    <span className={`text-[11.5px] font-medium flex items-center gap-1.5 ${
                      m.statusKind === "on" ? 'text-[hsl(145_65%_30%)]' :
                      m.statusKind === "pending" ? 'text-[hsl(35_90%_35%)]' :
                      m.statusKind === "away" ? 'text-[hsl(280_55%_45%)]' : 'text-[hsl(217_10%_46%)]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        m.statusKind === "on" ? 'bg-[hsl(145_65%_42%)]' :
                        m.statusKind === "pending" ? 'bg-[hsl(35_90%_50%)]' :
                        m.statusKind === "away" ? 'bg-[hsl(280_55%_58%)]' : 'bg-[hsl(217_10%_46%)]'
                      }`} />
                      {m.status}
                    </span>
                  </div>
                  <div className="text-[12.5px] text-[hsl(217_10%_46%)] tabular-nums">{m.last}</div>
                  <div className="text-[12.5px] tabular-nums font-medium">{m.hours}</div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                    <button className="p-1 rounded hover:bg-[hsl(217_6%_93%)]"><MoreHorizontal className="w-4 h-4 text-[hsl(217_10%_46%)]" /></button>
                  </div>
                </div>
              ))}

              {/* Footer with pending invite preview */}
              <div className="px-4 py-2.5 bg-[hsl(210_40%_98%)] border-t border-[hsl(217_12%_88%)] flex items-center gap-2.5 text-[12px]">
                <Mail className="w-3.5 h-3.5 text-[hsl(35_90%_35%)]" />
                <span className="text-[hsl(217_20%_30%)]"><b>3 more pending invites</b> · Jordan, Mia, Riley</span>
                <button className="ml-auto text-[hsl(217_91%_53%)] font-semibold flex items-center gap-1 hover:gap-1.5 transition-all">
                  Resend all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Add chooser preview hint */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                {Icon: UserPlus, title: "Invite member", desc: "Permanent staff with email login & role-based access.", tag: "Team Plan", tagColor: "hsl(217 91% 53%)"},
                {Icon: Link2, title: "Magic-link sub", desc: "One-job access via SMS — no app, no account needed.", tag: "Pro+", tagColor: "hsl(280 55% 58%)"},
                {Icon: ShieldCheck, title: "Account subcontractor", desc: "Recurring sub with their own dashboard & invoicing.", tag: "Team Plan", tagColor: "hsl(217 91% 53%)"},
              ].map((c) => (
                <button key={c.title} className="group text-left p-4 bg-white rounded-lg border border-[hsl(217_12%_88%)] hover:border-[hsl(217_33%_17%)] transition-colors premium-shadow">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="w-9 h-9 rounded-md bg-[hsl(217_6%_93%)] flex items-center justify-center group-hover:bg-[hsl(217_33%_17%)] group-hover:text-white transition-colors">
                      <c.Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `hsl(from ${c.tagColor} h s l / 0.1)`, color: c.tagColor }}>{c.tag}</span>
                  </div>
                  <div className="text-[13.5px] font-semibold mb-0.5">{c.title}</div>
                  <div className="text-[12px] text-[hsl(217_10%_46%)] leading-relaxed">{c.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

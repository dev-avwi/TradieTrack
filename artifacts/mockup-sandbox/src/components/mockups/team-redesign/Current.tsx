import './_group.css';
import {
  Users, Calendar, Clock, MessageCircle, Layers, LayoutDashboard,
  Briefcase, FileText, Settings, BarChart3, Map, DollarSign, Bot, LineChart,
  UserPlus, Mail, Search, MoreHorizontal, ChevronDown, Plus, Bell, HelpCircle,
  Zap, Camera, Receipt, Shield, Key, Calendar as CalIcon, AlertTriangle, RefreshCw
} from "lucide-react";

function SidebarItem({ icon: Icon, label, active, badge, sub }: any) {
  return (
    <div
      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer ${
        active ? 'bg-[hsl(217_91%_53%)] text-white' : 'text-[hsl(217_20%_14%)] hover:bg-[hsl(217_12%_90%)]'
      } ${sub ? 'pl-7 text-[13px]' : ''}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="ml-auto text-[10px] bg-[hsl(5_85%_55%)] text-white px-1.5 rounded-full font-medium">
          {badge}
        </span>
      )}
    </div>
  );
}

export function Current() {
  return (
    <div className="team-redesign-root min-h-screen flex bg-[hsl(210_40%_98%)] text-[hsl(217_33%_17%)]">
      {/* Sidebar */}
      <aside className="w-[260px] bg-[hsl(217_15%_94%)] border-r border-[hsl(217_12%_86%)] flex flex-col">
        <div className="px-3 py-3 border-b border-[hsl(217_12%_86%)] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[hsl(217_91%_53%)] flex items-center justify-center text-white text-xs font-bold">JR</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">Vogler Plumbing</div>
            <div className="text-[11px] text-[hsl(217_10%_46%)]">Team Plan</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-[hsl(217_10%_46%)] px-2.5 py-1.5 mt-1 font-semibold">Main Menu</div>
          <SidebarItem icon={LayoutDashboard} label="Dashboard" />
          <SidebarItem icon={Briefcase} label="Jobs" />
          <SidebarItem icon={FileText} label="Quotes & Invoices" />
          <SidebarItem icon={Users} label="Customers" />
          <SidebarItem icon={CalIcon} label="Schedule" />
          <SidebarItem icon={Clock} label="Time Tracking" />

          {/* Cluttered team area — highlighted as the problem */}
          <div className="relative mt-1 mb-1 rounded-md ring-1 ring-[hsl(5_85%_55%/0.4)] bg-[hsl(5_85%_55%/0.05)] py-1">
            <div className="absolute -top-2 left-2 px-1.5 bg-[hsl(5_85%_55%)] text-white text-[9px] font-bold uppercase tracking-wider rounded">
              5 entries — cluttered
            </div>
            <SidebarItem icon={Users} label="Team Management" active />
            <SidebarItem icon={LayoutDashboard} label="Team Dashboard" sub />
            <SidebarItem icon={Layers} label="Team Operations" sub />
            <SidebarItem icon={Layers} label="Team Groups" sub />
            <SidebarItem icon={MessageCircle} label="Team Chat" sub badge="3" />
          </div>

          <SidebarItem icon={MessageCircle} label="Chat" badge="12" />
          <SidebarItem icon={Map} label="Map" />
          <SidebarItem icon={LineChart} label="Insights" />
          <SidebarItem icon={DollarSign} label="Payroll" />
          <SidebarItem icon={Bot} label="Autopilot" />
          <SidebarItem icon={BarChart3} label="Reports" />
          <SidebarItem icon={Camera} label="Photos" />
          <SidebarItem icon={Receipt} label="Expenses" />
          <SidebarItem icon={Settings} label="Settings" />
        </div>

        <div className="border-t border-[hsl(217_12%_86%)] p-3 text-[11px] text-[hsl(217_10%_46%)]">
          Subcontractors live somewhere else entirely →
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-[hsl(217_12%_88%)] flex items-center px-5 gap-3">
          <button className="p-1.5 rounded hover:bg-[hsl(217_6%_93%)]"><Layers className="w-4 h-4" /></button>
          <div className="flex-1" />
          <button className="p-1.5 rounded hover:bg-[hsl(217_6%_93%)]"><Bell className="w-4 h-4" /></button>
          <button className="p-1.5 rounded hover:bg-[hsl(217_6%_93%)]"><HelpCircle className="w-4 h-4" /></button>
          <div className="w-7 h-7 rounded-full bg-[hsl(217_91%_53%)] text-white text-xs font-medium flex items-center justify-center">AV</div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Page header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight">Team Management</h1>
              <p className="text-[13px] text-[hsl(217_10%_46%)] mt-0.5">Manage members, invites, roles, skills, availability and time off</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-9 px-3 rounded-md border border-[hsl(217_12%_88%)] bg-white text-sm font-medium flex items-center gap-1.5">
                <Mail className="w-4 h-4" /> Invite via SMS
              </button>
              <button className="h-9 px-3 rounded-md bg-[hsl(217_91%_53%)] text-white text-sm font-medium flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" /> Add Member
              </button>
            </div>
          </div>

          {/* Cluttered tabs — too many */}
          <div className="border-b border-[hsl(217_12%_88%)] mb-5 flex items-center gap-0 overflow-x-auto">
            {[
              ["Members", true, "11"],
              ["Pending Invites", false, "4"],
              ["Roles & Permissions", false, ""],
              ["Skills", false, ""],
              ["Availability", false, ""],
              ["Time Off", false, "2"],
              ["Performance", false, ""],
              ["Permission Requests", false, "1"],
              ["Activity Log", false, ""],
            ].map(([label, active, count]) => (
              <button
                key={label as string}
                className={`px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 ${
                  active ? 'border-[hsl(217_91%_53%)] text-[hsl(217_91%_53%)]' : 'border-transparent text-[hsl(217_10%_46%)] hover:text-[hsl(217_33%_17%)]'
                }`}
              >
                {label}{count ? ` (${count})` : ''}
              </button>
            ))}
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-[320px]">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(217_10%_46%)]" />
              <input className="w-full h-9 pl-8 pr-3 rounded-md border border-[hsl(217_12%_88%)] bg-white text-sm" placeholder="Search members..." />
            </div>
            <button className="h-9 px-3 rounded-md border border-[hsl(217_12%_88%)] bg-white text-[13px] flex items-center gap-1.5">
              All Roles <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button className="h-9 px-3 rounded-md border border-[hsl(217_12%_88%)] bg-white text-[13px] flex items-center gap-1.5">
              All Status <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button className="h-9 px-3 rounded-md border border-[hsl(217_12%_88%)] bg-white text-[13px] flex items-center gap-1.5">
              All Skills <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button className="h-9 px-3 rounded-md border border-[hsl(217_12%_88%)] bg-white text-[13px]">Bulk actions</button>
          </div>

          {/* Mixed content card list */}
          <div className="bg-white border border-[hsl(217_12%_88%)] rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[hsl(217_10%_46%)] bg-[hsl(217_6%_93%)] border-b border-[hsl(217_12%_88%)]">
              <div className="col-span-3">Member</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Skills</div>
              <div className="col-span-2">Availability</div>
              <div className="col-span-1 text-right">·</div>
            </div>

            {[
              ["Sarah Chen", "Manager", "Active", "Plumbing, Roofing", "Mon-Fri", "SC", "hsl(217_91%_53%)"],
              ["Marcus Johnson", "Tradie", "Active", "Electrical", "Available now", "MJ", "hsl(145_65%_42%)"],
              ["Priya Patel", "Office Admin", "Pending", "—", "—", "PP", "hsl(35_90%_50%)"],
              ["Tom Reilly", "Tradie", "On time off", "Carpentry", "Back Mon", "TR", "hsl(280_55%_58%)"],
              ["Jay Williams", "Subcontractor", "Active", "HVAC", "Mon, Wed, Fri", "JW", "hsl(10_80%_58%)"],
              ["Liam Cox", "Tradie", "Inactive", "Plumbing", "—", "LC", "hsl(217_10%_46%)"],
            ].map(([name, role, status, skills, avail, init, color]) => (
              <div key={name} className="grid grid-cols-12 px-4 py-3 items-center text-[13px] border-b border-[hsl(217_12%_91%)] last:border-0 hover-row">
                <div className="col-span-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full text-white text-[11px] font-medium flex items-center justify-center" style={{ background: color as string }}>{init}</div>
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-[11px] text-[hsl(217_10%_46%)]">@{(name as string).toLowerCase().replace(' ', '')}</div>
                  </div>
                </div>
                <div className="col-span-2">{role}</div>
                <div className="col-span-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                    status === 'Active' ? 'bg-[hsl(145_65%_42%/0.12)] text-[hsl(145_65%_30%)]' :
                    status === 'Pending' ? 'bg-[hsl(35_90%_50%/0.15)] text-[hsl(35_90%_35%)]' :
                    status === 'On time off' ? 'bg-[hsl(280_55%_58%/0.12)] text-[hsl(280_55%_45%)]' :
                    'bg-[hsl(217_6%_93%)] text-[hsl(217_10%_46%)]'
                  }`}>{status}</span>
                </div>
                <div className="col-span-2 text-[hsl(217_10%_46%)] truncate">{skills}</div>
                <div className="col-span-2 text-[hsl(217_10%_46%)] truncate">{avail}</div>
                <div className="col-span-1 flex justify-end gap-0.5">
                  <button className="p-1 rounded hover:bg-[hsl(217_6%_93%)]"><Shield className="w-3.5 h-3.5 text-[hsl(217_10%_46%)]" /></button>
                  <button className="p-1 rounded hover:bg-[hsl(217_6%_93%)]"><Key className="w-3.5 h-3.5 text-[hsl(217_10%_46%)]" /></button>
                  <button className="p-1 rounded hover:bg-[hsl(217_6%_93%)]"><MoreHorizontal className="w-3.5 h-3.5 text-[hsl(217_10%_46%)]" /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Permission requests alert */}
          <div className="mt-4 flex items-center gap-2.5 p-3 bg-[hsl(35_90%_50%/0.1)] border border-[hsl(35_90%_50%/0.3)] rounded-md text-[13px]">
            <AlertTriangle className="w-4 h-4 text-[hsl(35_90%_35%)]" />
            <span><b>1 permission request</b> from Marcus Johnson — review in the Permission Requests tab.</span>
            <button className="ml-auto text-[hsl(217_91%_53%)] font-medium">Review →</button>
          </div>

          {/* Note about subs being elsewhere */}
          <div className="mt-3 flex items-center gap-2.5 p-3 bg-[hsl(217_6%_93%)] border border-[hsl(217_12%_88%)] rounded-md text-[13px] text-[hsl(217_10%_46%)]">
            <RefreshCw className="w-4 h-4" />
            <span>Looking for magic-link subcontractors? Those are managed per-job from the <b className="text-[hsl(217_33%_17%)]">Jobs</b> page.</span>
          </div>
        </div>
      </main>
    </div>
  );
}

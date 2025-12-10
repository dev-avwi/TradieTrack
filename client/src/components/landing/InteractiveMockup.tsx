import { useState } from "react";
import { 
  Monitor, 
  Smartphone, 
  Sun, 
  Moon, 
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Calendar,
  Settings,
  Bell,
  Search,
  Plus,
  ChevronRight,
  TrendingUp,
  Clock,
  MapPin,
  Phone,
  CheckCircle,
  DollarSign,
  Briefcase,
  Home,
  Menu
} from "lucide-react";

interface InteractiveMockupProps {
  className?: string;
}

export function InteractiveMockup({ className = "" }: InteractiveMockupProps) {
  const [activeView, setActiveView] = useState<"web" | "mobile">("web");
  const [isDark, setIsDark] = useState(false);

  return (
    <div className={`relative ${className}`}>
      {/* Toggle Controls */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {/* Device Toggle */}
        <div className="inline-flex items-center p-1 rounded-full bg-slate-200 dark:bg-slate-800">
          <button
            onClick={() => setActiveView("web")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              activeView === "web"
                ? "bg-blue-600 text-white shadow-lg"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            data-testid="toggle-web-view"
          >
            <Monitor className="w-4 h-4" />
            Web App
          </button>
          <button
            onClick={() => setActiveView("mobile")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              activeView === "mobile"
                ? "bg-orange-500 text-white shadow-lg"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            data-testid="toggle-mobile-view"
          >
            <Smartphone className="w-4 h-4" />
            Mobile App
          </button>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          data-testid="toggle-theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Mockup Display Area */}
      <div className="relative flex items-center justify-center min-h-[500px]">
        {/* Web Mockup */}
        <div
          className={`absolute transition-all duration-500 ease-in-out ${
            activeView === "web"
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-4 scale-95 pointer-events-none"
          }`}
        >
          <WebMockup isDark={isDark} />
        </div>

        {/* Mobile Mockup */}
        <div
          className={`absolute transition-all duration-500 ease-in-out ${
            activeView === "mobile"
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-4 scale-95 pointer-events-none"
          }`}
        >
          <MobileMockup isDark={isDark} />
        </div>
      </div>
    </div>
  );
}

function WebMockup({ isDark }: { isDark: boolean }) {
  const bgMain = isDark ? "bg-slate-900" : "bg-white";
  const bgSidebar = isDark ? "bg-slate-800" : "bg-slate-50";
  const bgCard = isDark ? "bg-slate-800" : "bg-white";
  const borderColor = isDark ? "border-slate-700" : "border-slate-200";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const textMuted = isDark ? "text-slate-500" : "text-slate-400";

  return (
    <div className="w-[800px] max-w-[90vw] rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700">
      {/* Browser Chrome */}
      <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} px-4 py-3 flex items-center gap-3 ${borderColor} border-b`}>
        {/* Traffic Lights */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        
        {/* Address Bar */}
        <div className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md ${isDark ? "bg-slate-700" : "bg-white"} ${borderColor} border`}>
          <div className="w-4 h-4 rounded bg-green-500/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <span className={`text-xs ${textSecondary}`}>app.tradietrack.com.au/dashboard</span>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className={`${bgMain} flex`} style={{ height: "450px" }}>
        {/* Sidebar */}
        <div className={`w-56 ${bgSidebar} ${borderColor} border-r p-4 flex flex-col`}>
          {/* Logo */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <span className={`font-bold ${textPrimary}`}>TradieTrack</span>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1 flex-1">
            {[
              { icon: LayoutDashboard, label: "Dashboard", active: true },
              { icon: Briefcase, label: "Jobs", count: 12 },
              { icon: Users, label: "Clients" },
              { icon: FileText, label: "Quotes", count: 3 },
              { icon: CreditCard, label: "Invoices" },
              { icon: Calendar, label: "Calendar" },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                  item.active
                    ? "bg-blue-600 text-white"
                    : `${textSecondary} hover:${bgCard}`
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.count && (
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                    item.active ? "bg-blue-500" : isDark ? "bg-slate-700" : "bg-slate-200"
                  }`}>
                    {item.count}
                  </span>
                )}
              </div>
            ))}
          </nav>

          {/* Settings */}
          <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${textSecondary}`}>
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={`text-xl font-bold ${textPrimary}`}>Good morning, Luke</h1>
              <p className={`text-sm ${textSecondary}`}>Here's what's happening today</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-100"} ${borderColor} border`}>
                <Search className="w-4 h-4 text-slate-400" />
                <span className={`text-sm ${textMuted}`}>Search...</span>
              </div>
              <button className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <Bell className={`w-5 h-5 ${textSecondary}`} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" />
                New Job
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Today's Jobs", value: "5", icon: Briefcase, color: "blue" },
              { label: "Pending Quotes", value: "$12,450", icon: FileText, color: "orange" },
              { label: "Overdue Invoices", value: "2", icon: CreditCard, color: "red" },
              { label: "This Month", value: "$28,350", icon: TrendingUp, color: "green" },
            ].map((stat) => (
              <div key={stat.label} className={`${bgCard} ${borderColor} border rounded-xl p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs ${textSecondary}`}>{stat.label}</span>
                  <stat.icon className={`w-4 h-4 text-${stat.color}-500`} />
                </div>
                <p className={`text-2xl font-bold ${textPrimary}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Today's Schedule */}
          <div className={`${bgCard} ${borderColor} border rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`font-semibold ${textPrimary}`}>Today's Schedule</h2>
              <button className={`text-sm ${textSecondary} flex items-center gap-1`}>
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { time: "8:00 AM", client: "Smith Residence", task: "Hot water system install", status: "In Progress" },
                { time: "11:30 AM", client: "Oceanview Apartments", task: "Electrical inspection", status: "Scheduled" },
                { time: "2:00 PM", client: "Johnson Kitchen", task: "Tap replacement", status: "Scheduled" },
              ].map((job, i) => (
                <div key={i} className={`flex items-center gap-4 p-3 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-slate-50"}`}>
                  <div className={`text-xs font-medium ${textSecondary} w-16`}>{job.time}</div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${textPrimary}`}>{job.client}</p>
                    <p className={`text-xs ${textSecondary}`}>{job.task}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    job.status === "In Progress" 
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" 
                      : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  }`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileMockup({ isDark }: { isDark: boolean }) {
  const bgMain = isDark ? "bg-slate-900" : "bg-slate-50";
  const bgCard = isDark ? "bg-slate-800" : "bg-white";
  const borderColor = isDark ? "border-slate-700" : "border-slate-200";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div className="relative">
      {/* Phone Frame */}
      <div 
        className={`w-[280px] rounded-[40px] p-3 shadow-2xl ${
          isDark ? "bg-slate-800" : "bg-slate-900"
        }`}
        style={{ 
          boxShadow: isDark 
            ? "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)" 
            : "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
        }}
      >
        {/* Screen */}
        <div className={`${bgMain} rounded-[32px] overflow-hidden`} style={{ height: "560px" }}>
          {/* Status Bar */}
          <div className={`px-6 pt-3 pb-2 flex items-center justify-between ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
            <span className={`text-xs font-medium ${textPrimary}`}>9:41</span>
            {/* Notch */}
            <div className="absolute left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full" />
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                <div className={`w-1 h-2 rounded-sm ${isDark ? "bg-white" : "bg-slate-900"}`} />
                <div className={`w-1 h-3 rounded-sm ${isDark ? "bg-white" : "bg-slate-900"}`} />
                <div className={`w-1 h-4 rounded-sm ${isDark ? "bg-white" : "bg-slate-900"}`} />
                <div className={`w-1 h-3 rounded-sm ${isDark ? "bg-white/50" : "bg-slate-400"}`} />
              </div>
              <div className={`w-6 h-3 rounded-sm border ${isDark ? "border-white" : "border-slate-900"} flex items-center justify-end pr-0.5`}>
                <div className={`w-4 h-2 rounded-sm ${isDark ? "bg-green-400" : "bg-green-500"}`} />
              </div>
            </div>
          </div>

          {/* App Header */}
          <div className={`px-4 py-3 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">LH</span>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${textPrimary}`}>Hey Luke!</p>
                  <p className={`text-xs ${textSecondary}`}>5 jobs today</p>
                </div>
              </div>
              <button className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                <Bell className="w-5 h-5 text-orange-500" />
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`${bgCard} ${borderColor} border rounded-xl p-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span className={`text-xs ${textSecondary}`}>Today</span>
                </div>
                <p className={`text-lg font-bold ${textPrimary}`}>$2,450</p>
              </div>
              <div className={`${bgCard} ${borderColor} border rounded-xl p-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-orange-500" />
                  <span className={`text-xs ${textSecondary}`}>Pending</span>
                </div>
                <p className={`text-lg font-bold ${textPrimary}`}>3 quotes</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-2 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-sm font-semibold ${textPrimary}`}>Today's Jobs</h2>
              <button className={`text-xs text-orange-500 font-medium`}>See all</button>
            </div>

            {/* Job Cards */}
            <div className="space-y-3">
              {[
                { time: "8:00 AM", client: "Smith Residence", task: "Hot water install", status: "active" },
                { time: "11:30 AM", client: "Oceanview Apts", task: "Electrical check", status: "next" },
                { time: "2:00 PM", client: "Johnson Kitchen", task: "Tap replacement", status: "later" },
              ].map((job, i) => (
                <div 
                  key={i} 
                  className={`${bgCard} ${borderColor} border rounded-xl p-3 ${
                    job.status === "active" ? "border-orange-500 border-2" : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${job.status === "active" ? "text-orange-500" : textSecondary}`} />
                      <span className={`text-xs font-medium ${job.status === "active" ? "text-orange-500" : textSecondary}`}>
                        {job.time}
                      </span>
                    </div>
                    {job.status === "active" && (
                      <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-full font-medium">
                        NOW
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-medium ${textPrimary} mb-1`}>{job.client}</p>
                  <p className={`text-xs ${textSecondary} mb-2`}>{job.task}</p>
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-3 h-3 ${textSecondary}`} />
                    <span className={`text-[10px] ${textSecondary}`}>2.4 km away</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Nav */}
          <div className={`absolute bottom-3 left-3 right-3 ${bgCard} ${borderColor} border rounded-2xl p-2 flex items-center justify-around`}>
            {[
              { icon: Home, label: "Home", active: true },
              { icon: Briefcase, label: "Jobs" },
              { icon: Plus, label: "Add", accent: true },
              { icon: MapPin, label: "Map" },
              { icon: Menu, label: "More" },
            ].map((item) => (
              <button
                key={item.label}
                className={`flex flex-col items-center gap-1 px-3 py-1 ${
                  item.accent
                    ? "bg-orange-500 rounded-xl -mt-4 shadow-lg"
                    : ""
                }`}
              >
                <item.icon className={`w-5 h-5 ${
                  item.accent 
                    ? "text-white" 
                    : item.active 
                    ? "text-orange-500" 
                    : textSecondary
                }`} />
                {!item.accent && (
                  <span className={`text-[10px] ${item.active ? "text-orange-500 font-medium" : textSecondary}`}>
                    {item.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Decorative glow */}
      <div className="absolute -inset-4 bg-gradient-to-b from-orange-500/20 to-transparent rounded-full blur-3xl -z-10" />
    </div>
  );
}

export default InteractiveMockup;

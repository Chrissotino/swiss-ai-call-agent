import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneOff,
  Activity, Users, BarChart3, Settings, AlertTriangle,
  CheckCircle, Clock, RefreshCw, Flag
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface CallRecord {
  callId: string;
  callType: "inbound" | "outbound";
  status: "active" | "completed" | "escalated" | "failed";
  customerName?: string;
  language: string;
  startedAt: string;
}

interface Stats {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  escalatedCalls: number;
  successRate: number;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const COLORS = {
  active: "#22c55e",
  completed: "#3b82f6",
  escalated: "#f59e0b",
  failed: "#ef4444",
};

const LANG_FLAGS: Record<string, string> = {
  "de-CH": "🇨🇭",
  de: "🇩🇪",
  fr: "🇫🇷",
  it: "🇮🇹",
};

// ─────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CallRecord["status"] }) {
  const styles: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border border-green-500/30",
    completed: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    escalated: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
    failed: "bg-red-500/20 text-red-400 border border-red-500/30",
  };
  const icons: Record<string, JSX.Element> = {
    active: <Activity size={10} className="inline mr-1" />,
    completed: <CheckCircle size={10} className="inline mr-1" />,
    escalated: <AlertTriangle size={10} className="inline mr-1" />,
    failed: <PhoneOff size={10} className="inline mr-1" />,
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {icons[status]}{status}
    </span>
  );
}

function StatCard({
  icon: Icon, label, value, color, sub
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className="text-white text-2xl font-bold">{value}</p>
        {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────

export default function App() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCalls: 0, activeCalls: 0, completedCalls: 0, escalatedCalls: 0, successRate: 0,
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "calls" | "settings">("dashboard");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // New outbound call form
  const [newCallForm, setNewCallForm] = useState({
    phone: "", goal: "", customerName: "", language: "de-CH",
  });
  const [submitting, setSubmitting] = useState(false);
  const [callResult, setCallResult] = useState<string | null>(null);

  const fetchCalls = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/calls`);
      const data: CallRecord[] = response.data.calls ?? [];
      setCalls(data);

      const total = data.length;
      const active = data.filter((c) => c.status === "active").length;
      const completed = data.filter((c) => c.status === "completed").length;
      const escalated = data.filter((c) => c.status === "escalated").length;
      const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      setStats({ totalCalls: total, activeCalls: active, completedCalls: completed, escalatedCalls: escalated, successRate });
      setLastRefresh(new Date());
    } catch {
      // API may not be running in dev
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchCalls]);

  const handleStartCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCallForm.phone || !newCallForm.goal) return;
    setSubmitting(true);
    setCallResult(null);
    try {
      const res = await axios.post(`${API_URL}/calls/start`, {
        callType: "outbound",
        ...newCallForm,
      });
      setCallResult(`✅ Call started! ID: ${res.data.callId}`);
      setNewCallForm({ phone: "", goal: "", customerName: "", language: "de-CH" });
      await fetchCalls();
    } catch {
      setCallResult("❌ Failed to start call. Is the API running?");
    } finally {
      setSubmitting(false);
    }
  };

  // Chart data
  const pieData = [
    { name: "Completed", value: stats.completedCalls, color: COLORS.completed },
    { name: "Active", value: stats.activeCalls, color: COLORS.active },
    { name: "Escalated", value: stats.escalatedCalls, color: COLORS.escalated },
  ].filter((d) => d.value > 0);

  const langDistribution = calls.reduce<Record<string, number>>((acc, c) => {
    acc[c.language] = (acc[c.language] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🇨🇭</span>
          <div>
            <h1 className="text-lg font-bold text-white">Swiss AI Call Agent</h1>
            <p className="text-gray-400 text-xs">Enterprise Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-xs">
            <Clock size={12} className="inline mr-1" />
            Last refresh: {lastRefresh.toLocaleTimeString("de-CH")}
          </span>
          <button
            onClick={fetchCalls}
            disabled={loading}
            className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700 px-6">
        <div className="flex gap-1">
          {(["dashboard", "calls", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
                activeTab === tab
                  ? "border-red-500 text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {tab === "dashboard" && <BarChart3 size={14} className="inline mr-1.5" />}
              {tab === "calls" && <Phone size={14} className="inline mr-1.5" />}
              {tab === "settings" && <Settings size={14} className="inline mr-1.5" />}
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        {/* ── Dashboard Tab ─────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Phone} label="Total Calls" value={stats.totalCalls} color="bg-gray-600" />
              <StatCard icon={Activity} label="Active Now" value={stats.activeCalls} color="bg-green-600" sub="live" />
              <StatCard icon={AlertTriangle} label="Escalated" value={stats.escalatedCalls} color="bg-yellow-600" />
              <StatCard icon={BarChart3} label="Success Rate" value={`${stats.successRate}%`} color="bg-blue-600" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Call Status Pie */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="text-white font-semibold mb-4">Call Status Distribution</h2>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-500">
                    No call data yet
                  </div>
                )}
              </div>

              {/* Language Distribution */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="text-white font-semibold mb-4">Language Distribution</h2>
                <div className="space-y-3">
                  {Object.entries(langDistribution).map(([lang, count]) => (
                    <div key={lang} className="flex items-center gap-3">
                      <span className="text-xl w-8">{LANG_FLAGS[lang] ?? "🌐"}</span>
                      <span className="text-gray-300 text-sm w-16">{lang}</span>
                      <div className="flex-1 bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-red-500 h-2 rounded-full"
                          style={{ width: `${(count / (calls.length || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-400 text-sm w-6 text-right">{count}</span>
                    </div>
                  ))}
                  {Object.keys(langDistribution).length === 0 && (
                    <p className="text-gray-500 text-sm">No data yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Calls Tab ─────────────────────────────────────── */}
        {activeTab === "calls" && (
          <div className="space-y-6">
            {/* Start New Call */}
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h2 className="text-white font-semibold mb-4">
                <PhoneOutgoing size={16} className="inline mr-2" />
                Start Outbound Call
              </h2>
              <form onSubmit={handleStartCall} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text" placeholder="+41 79 123 45 67" required
                  value={newCallForm.phone}
                  onChange={(e) => setNewCallForm((f) => ({ ...f, phone: e.target.value }))}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                />
                <input
                  type="text" placeholder="Customer name (optional)"
                  value={newCallForm.customerName}
                  onChange={(e) => setNewCallForm((f) => ({ ...f, customerName: e.target.value }))}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                />
                <input
                  type="text" placeholder="Call goal / purpose" required
                  value={newCallForm.goal}
                  onChange={(e) => setNewCallForm((f) => ({ ...f, goal: e.target.value }))}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                />
                <div className="flex gap-2">
                  <select
                    value={newCallForm.language}
                    onChange={(e) => setNewCallForm((f) => ({ ...f, language: e.target.value }))}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="de-CH">🇨🇭 de-CH</option>
                    <option value="de">🇩🇪 de</option>
                    <option value="fr">🇫🇷 fr</option>
                    <option value="it">🇮🇹 it</option>
                  </select>
                  <button
                    type="submit" disabled={submitting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {submitting ? "..." : "Call"}
                  </button>
                </div>
              </form>
              {callResult && (
                <p className="mt-2 text-sm text-gray-300">{callResult}</p>
              )}
            </div>

            {/* Active Calls List */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-white font-semibold">
                  <Users size={16} className="inline mr-2" />
                  All Calls ({calls.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-700">
                {calls.length === 0 ? (
                  <div className="px-5 py-8 text-center text-gray-500">
                    No calls yet. Start an outbound call above or wait for inbound calls.
                  </div>
                ) : (
                  calls.map((call) => (
                    <div key={call.callId} className="px-5 py-4 flex items-center justify-between hover:bg-gray-750">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${call.callType === "inbound" ? "bg-blue-500/20" : "bg-purple-500/20"}`}>
                          {call.callType === "inbound"
                            ? <PhoneIncoming size={14} className="text-blue-400" />
                            : <PhoneOutgoing size={14} className="text-purple-400" />
                          }
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {call.customerName ?? "Unknown Customer"}
                            <span className="ml-2 text-gray-400 text-xs">{LANG_FLAGS[call.language]}</span>
                          </p>
                          <p className="text-gray-400 text-xs font-mono">{call.callId.slice(0, 8)}…</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-xs">
                          {new Date(call.startedAt).toLocaleString("de-CH")}
                        </span>
                        <StatusBadge status={call.status} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Settings Tab ──────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Settings size={18} /> Configuration
            </h2>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <span>API Endpoint</span>
                <code className="text-red-400 text-xs">{API_URL}</code>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <span>Decision Engine</span>
                <span className="text-green-400 flex items-center gap-1"><CheckCircle size={12} /> Claude AI</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <span>Orchestration</span>
                <span className="text-blue-400">MCP (Model Context Protocol)</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <span>Data Residency</span>
                <span className="text-white flex items-center gap-1"><Flag size={12} /> Switzerland</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <span>Compliance</span>
                <span className="text-green-400">DSG/nDSG + GDPR</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

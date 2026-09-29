"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/domain";

interface Overview {
  revenue: number;
  appointmentsByStatus: { status: string; _count: number }[];
  noShowPct: number;
  newPatients: number;
  whatsappBookings: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-violet-100 text-violet-800",
  IN_CONSULTATION: "bg-brand-100 text-brand-900",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-600",
  NO_SHOW: "bg-red-100 text-red-800",
};

export default function OwnerDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<Overview>("/analytics/overview").then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="card text-red-600">Failed to load: {err}</div>;
  if (!data) return <div className="text-slate-400">Loading dashboard…</div>;

  const cards = [
    { label: "Revenue (30d)", value: money(data.revenue), icon: "💰", tint: "bg-emerald-50" },
    { label: "No-show rate", value: `${data.noShowPct}%`, icon: "⚠️", tint: "bg-amber-50" },
    { label: "New patients", value: String(data.newPatients), icon: "🧑‍⚕️", tint: "bg-blue-50" },
    { label: "WhatsApp bookings", value: String(data.whatsappBookings), icon: "💬", tint: "bg-brand-50" },
  ];
  const max = Math.max(1, ...data.appointmentsByStatus.map((a) => a._count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Owner dashboard</h1>
        <p className="text-slate-500 text-sm">Money in, patients flowing, problems visible.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${c.tint} flex items-center justify-center text-xl`}>{c.icon}</div>
            <div>
              <div className="text-xl font-bold">{c.value}</div>
              <div className="text-xs text-slate-500">{c.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2 className="font-semibold mb-4">Appointment funnel (30d)</h2>
        <div className="space-y-2.5">
          {data.appointmentsByStatus.map((a) => (
            <div key={a.status} className="flex items-center gap-3">
              <span className={`pill ${STATUS_COLORS[a.status] ?? "bg-slate-100"} w-36 justify-center`}>{a.status}</span>
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(a._count / max) * 100}%` }} />
              </div>
              <span className="text-sm font-semibold w-8 text-right">{a._count}</span>
            </div>
          ))}
          {data.appointmentsByStatus.length === 0 && <p className="text-sm text-slate-400">No appointments in range.</p>}
        </div>
      </div>
    </div>
  );
}

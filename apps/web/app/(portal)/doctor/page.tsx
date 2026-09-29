"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface QueueItem {
  id: string;
  tokenNumber: number | null;
  status: string;
  scheduledAt: string;
  patient: { id: string; name: string; phone: string };
  doctor: { user: { name: string } };
}

export default function DoctorQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [err, setErr] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const load = () =>
    api<{ data: QueueItem[] }>(`/queue?date=${today}`).then((d) => setQueue(d.data)).catch((e) => setErr(e.message));
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const move = async (id: string, status: string) => {
    try {
      await api(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Today's queue</h1>
        <p className="text-slate-500 text-sm">Token order. Tap to move the patient along.</p>
      </div>
      {err && <div className="card text-red-600">{err}</div>}
      <div className="space-y-3">
        {queue.map((q) => (
          <div key={q.id} className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
              {q.tokenNumber ?? "–"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{q.patient.name}</div>
              <div className="text-xs text-slate-500">
                {q.patient.phone} · {new Date(q.scheduledAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })} · {q.doctor.user.name}
              </div>
            </div>
            <span className="pill bg-slate-100 text-slate-700">{q.status.replace(/_/g, " ")}</span>
            <div className="flex gap-2">
              {q.status === "CHECKED_IN" && <button className="btn-primary !py-1.5 !px-3 text-sm" onClick={() => move(q.id, "IN_CONSULTATION")}>Start →</button>}
              {q.status === "IN_CONSULTATION" && <button className="btn-primary !py-1.5 !px-3 text-sm" onClick={() => move(q.id, "COMPLETED")}>Done ✓</button>}
              {q.status === "CONFIRMED" && <button className="btn-ghost !py-1.5 !px-3 text-sm" onClick={() => move(q.id, "NO_SHOW")}>No-show</button>}
            </div>
          </div>
        ))}
        {queue.length === 0 && <div className="card text-slate-400 text-center">No patients in queue today.</div>}
      </div>
    </div>
  );
}

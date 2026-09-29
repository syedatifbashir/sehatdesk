"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function LabQueue() {
  const [orders, setOrders] = useState<{ id: string; status: string; total: number; patient: { name: string }; items: { testName: string }[] }[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ data: typeof orders }>("/lab/orders").then((d) => setOrders(d.data)).catch((e) => setErr(e.message));
  }, []);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Lab queue</h1>
      {err && <div className="card text-amber-700">Lab API lands in Phase 10 — {err}</div>}
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="card flex items-center gap-3">
            <span className="text-2xl">🧪</span>
            <div className="flex-1">
              <div className="font-semibold">{o.patient.name}</div>
              <div className="text-xs text-slate-500">{o.items.map((i) => i.testName).join(", ")} · Rs {o.total}</div>
            </div>
            <span className="pill bg-blue-100 text-blue-800">{o.status.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function NurseWard() {
  const [beds, setBeds] = useState<{ beds: unknown[] }>({ beds: [] });
  const [err, setErr] = useState("");
  useEffect(() => {
    // Ward board comes from the beds endpoint family in Phase 9; showing beds via direct query here
    api<{ data: { room: { roomNo: string; ward: { name: string } }; bedNo: string; status: string }[] }>("/beds")
      .then((d) => setBeds({ beds: d.data }))
      .catch((e) => setErr(e.message));
  }, []);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Ward board</h1>
      {err && <div className="card text-amber-700">Ward API lands in Phase 9 — {err}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(beds.beds as { room: { roomNo: string; ward: { name: string } }; bedNo: string; status: string }[]).map((b, i) => (
          <div key={i} className={`card text-center ${b.status === "OCCUPIED" ? "!bg-red-50 !border-red-200" : "!bg-emerald-50 !border-emerald-200"}`}>
            <div className="text-2xl">🛏️</div>
            <div className="font-semibold text-sm">{b.room.ward.name} · R{b.room.roomNo} · B{b.bedNo}</div>
            <div className="text-xs mt-1">{b.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

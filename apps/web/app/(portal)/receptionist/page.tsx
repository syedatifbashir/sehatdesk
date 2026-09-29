"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Doctor { id: string; name: string; specialization: string; consultationFee: number }
interface Appt {
  id: string; tokenNumber: number | null; status: string; scheduledAt: string;
  patient: { name: string; phone: string };
}

export default function ReceptionistDesk() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [form, setForm] = useState({ doctorId: "", patientName: "", patientPhone: "", date: new Date().toISOString().slice(0, 10), slot: "" });
  const [slots, setSlots] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const load = () => {
    api<{ data: Doctor[] }>("/doctors").then((d) => setDoctors(d.data));
    api<{ data: Appt[] }>(`/appointments?date=${today}`).then((d) => setAppts(d.data));
  };
  useEffect(load, []);

  useEffect(() => {
    if (form.doctorId && form.date)
      api<{ slots: string[] }>(`/doctors/${form.doctorId}/availability?date=${form.date}`).then((d) => setSlots(d.slots));
  }, [form.doctorId, form.date]);

  const book = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("");
    try {
      const patient = await api<{ data: { id: string } }>("/patients", {
        method: "POST", body: JSON.stringify({ name: form.patientName, phone: form.patientPhone }),
      });
      const scheduledAt = `${form.date}T${form.slot}:00+05:00`;
      await api("/appointments", {
        method: "POST",
        body: JSON.stringify({ patientId: patient.data.id, doctorId: form.doctorId, scheduledAt, source: "PORTAL" }),
      });
      setMsg("✅ Appointment booked.");
      setForm({ ...form, patientName: "", patientPhone: "", slot: "" });
      load();
    } catch (e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "failed")); }
  };

  const checkIn = async (id: string) => {
    await api(`/appointments/${id}/check-in`, { method: "POST" });
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Front desk</h1>

      <div className="card">
        <h2 className="font-semibold mb-4">Book appointment</h2>
        <form onSubmit={book} className="grid md:grid-cols-3 gap-4">
          <div><label className="label">Doctor</label>
            <select className="input" value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })} required>
              <option value="">Select…</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>)}
            </select></div>
          <div><label className="label">Date</label>
            <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <div><label className="label">Slot</label>
            <select className="input" value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} required>
              <option value="">Select…</option>
              {slots.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
          <div><label className="label">Patient name</label>
            <input className="input" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} required /></div>
          <div><label className="label">Patient phone</label>
            <input className="input" placeholder="+923001234567" value={form.patientPhone} onChange={(e) => setForm({ ...form, patientPhone: e.target.value })} required /></div>
          <div className="flex items-end"><button className="btn-primary w-full">Book</button></div>
        </form>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Today's appointments ({appts.length})</h2>
        <div className="space-y-2">
          {appts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
              <span className="font-mono text-sm w-14">{new Date(a.scheduledAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</span>
              {a.tokenNumber != null && <span className="pill bg-brand-100 text-brand-900">#{a.tokenNumber}</span>}
              <span className="flex-1 font-medium">{a.patient.name}</span>
              <span className="pill bg-slate-100 text-slate-600 text-xs">{a.status.replace(/_/g, " ")}</span>
              {(a.status === "CONFIRMED" || a.status === "PENDING") && (
                <button className="btn-ghost !py-1 !px-3 text-sm" onClick={() => checkIn(a.id)}>Check in</button>
              )}
            </div>
          ))}
          {appts.length === 0 && <p className="text-sm text-slate-400">Nothing booked today.</p>}
        </div>
      </div>
    </div>
  );
}

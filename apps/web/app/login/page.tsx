"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Login failed");
      localStorage.setItem("hms_token", data.accessToken);
      localStorage.setItem("hms_refresh", data.refreshToken);
      localStorage.setItem("hms_role", data.user.role);
      const dest: Record<string, string> = {
        OWNER: "/owner", ADMIN: "/owner", DOCTOR: "/doctor",
        RECEPTIONIST: "/receptionist", NURSE: "/nurse", LAB_STAFF: "/lab",
      };
      router.push(dest[data.user.role] ?? "/receptionist");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white text-2xl font-bold shadow-lg shadow-brand-600/30">S</div>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">SehatDesk</h1>
          <p className="text-slate-500 mt-1">Hospital management, WhatsApp-first</p>
        </div>
        <form onSubmit={submit} className="card space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{err}</div>}
          <div>
            <label className="label">Phone number</label>
            <input className="input" placeholder="+923000000001" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="text-xs text-slate-400 text-center">Demo: +923000000001 / password123 (owner)</p>
        </form>
      </div>
    </div>
  );
}

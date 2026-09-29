"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  OWNER: [
    { href: "/owner", label: "Dashboard", icon: "📊" },
    { href: "/receptionist", label: "Front desk", icon: "🗓️" },
    { href: "/doctor", label: "Doctor view", icon: "🩺" },
  ],
  ADMIN: [
    { href: "/owner", label: "Dashboard", icon: "📊" },
    { href: "/receptionist", label: "Front desk", icon: "🗓️" },
  ],
  DOCTOR: [{ href: "/doctor", label: "My queue", icon: "🩺" }],
  RECEPTIONIST: [{ href: "/receptionist", label: "Front desk", icon: "🗓️" }],
  NURSE: [{ href: "/nurse", label: "Ward", icon: "🛏️" }],
  LAB_STAFF: [{ href: "/lab", label: "Lab queue", icon: "🧪" }],
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<{ name: string; role: string; hospital: { name: string } } | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    api<{ user: { name: string; role: string; hospital: { name: string } } }>("/auth/me")
      .then((d) => setMe(d.user))
      .catch(() => router.push("/login"));
  }, [router]);

  if (!me)
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;

  const items = NAV[me.role] ?? [];
  const logout = () => {
    localStorage.clear();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-200 flex flex-col max-md:hidden">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold">S</div>
            <div>
              <div className="font-bold text-white leading-tight">SehatDesk</div>
              <div className="text-xs text-slate-400 truncate max-w-[10rem]">{me.hospital.name}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((i) => (
            <Link key={i.href} href={i.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${pathname === i.href ? "bg-brand-600 text-white" : "hover:bg-slate-800"}`}>
              <span>{i.icon}</span> {i.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="text-sm font-medium text-white">{me.name}</div>
          <div className="text-xs text-slate-400 mb-2">{me.role}</div>
          <button onClick={logout} className="text-xs text-slate-400 hover:text-white">Sign out →</button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <span className="font-bold">SehatDesk</span>
          <button onClick={logout} className="text-xs opacity-70">Sign out</button>
        </header>
        <nav className="md:hidden flex gap-2 p-3 overflow-x-auto bg-white border-b">
          {items.map((i) => (
            <Link key={i.href} href={i.href}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm ${pathname === i.href ? "bg-brand-600 text-white" : "bg-slate-100"}`}>
              {i.icon} {i.label}
            </Link>
          ))}
        </nav>
        <main className="p-4 md:p-8 max-w-6xl mx-auto">{children}</main>
      </div>
    </div>
  );
}

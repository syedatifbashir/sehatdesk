import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SehatDesk — Hospital OS",
  description: "WhatsApp-first hospital management for Pakistan",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

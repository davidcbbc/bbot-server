import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BBOT Server Dashboard",
  description: "Shadcn UI dashboard for BBOT Server data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

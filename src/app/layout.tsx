import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Binee — AI Workspace Intelligence",
  description:
    "Power up your ClickUp with AI. Setup, health monitoring, custom dashboards, and team workspace intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Binee - AI Workspace Intelligence",
  description:
    "Power up your ClickUp with AI. Setup, health monitoring, custom dashboards, and team workspace intelligence.",
  icons: {
    icon: [
      { url: "/Binee__icon__white.svg", type: "image/svg+xml" },
      { url: "/Binee__icon__white.png", type: "image/png" },
    ],
    apple: "/Binee__icon__white.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

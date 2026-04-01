import type { Metadata } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import { QueryProvider } from "@/lib/query/provider";
import { AuthProviderWrapper } from "@/components/auth/AuthProviderWrapper";
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <QueryProvider>
            <AuthProviderWrapper>{children}</AuthProviderWrapper>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

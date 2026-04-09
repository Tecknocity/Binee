import type { Metadata } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import { QueryProvider } from "@/lib/query/provider";
import { AuthProviderWrapper } from "@/components/auth/AuthProviderWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Binee - AI Workspace Intelligence",
  description:
    "Power up your ClickUp with AI. Setup, sync, and team workspace intelligence.",
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
        {/* Client-side cookie size guard: runs before React hydration.
            If cookies are approaching Vercel's 16KB header limit, clear
            all auth cookies immediately to prevent 494 lockout. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=document.cookie;if(c.length>13000){var all=c.split(";");for(var i=0;i<all.length;i++){var n=all[i].split("=")[0].trim();if(n.startsWith("sb-")){document.cookie=n+"=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";document.cookie=n+"=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain="+location.hostname;document.cookie=n+"=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=."+location.hostname}}try{Object.keys(localStorage).forEach(function(k){if(k.startsWith("sb-")||k.includes("supabase"))localStorage.removeItem(k)});Object.keys(sessionStorage).forEach(function(k){if(k.startsWith("sb-")||k.includes("supabase"))sessionStorage.removeItem(k)})}catch(e){}if(location.pathname!=="/login"){location.href="/login"}}}catch(e){}})();`,
          }}
        />
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

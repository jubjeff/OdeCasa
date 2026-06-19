import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ÔdeCasa",
  description: "Delivery multi-loja",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "ÔdeCasa", statusBarStyle: "default" },
  other: { "theme-color": "#0E9F5E", "mobile-web-app-capable": "yes" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0E9F5E" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="ÔdeCasa" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
            gap={8}
            offset={16}
            toastOptions={{ style: { fontFamily: 'var(--font-plus-jakarta-sans)' } }}
          />
        </Providers>
      </body>
    </html>
  );
}

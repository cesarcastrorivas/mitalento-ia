import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#4C1D95",
};

export const metadata: Metadata = {
  title: "Mi Talento Urbanity",
  description: "Plataforma de entrenamiento dinámico con videos y evaluaciones personalizadas por IA",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mi Talento",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} bg-bg-main text-text-primary antialiased selection:bg-primary-500/20`}>
        <AuthProvider>
          {children}
        </AuthProvider>

        {/* Service Worker Registration */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(function(reg) {
                  console.log('[PWA] Service Worker registered, scope:', reg.scope);
                  // Check for updates periodically
                  setInterval(function() { reg.update(); }, 60 * 60 * 1000);
                })
                .catch(function(err) {
                  console.log('[PWA] Service Worker registration failed:', err);
                });
            });
          }
        `}</Script>
      </body>
    </html>
  );
}

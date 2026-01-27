import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Serif for headlines - optical sizing for excellent readability at all sizes
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "News Pulse",
    template: "%s | News Pulse",
  },
  description: "News Before Its News. Real-time monitoring of breaking news, seismic activity, and geopolitical events from 380+ verified sources worldwide.",
  keywords: ["news", "OSINT", "intelligence", "geopolitical", "monitoring", "real-time", "global news", "breaking news", "earthquake", "pulse alert"],
  authors: [{ name: "News Pulse" }],
  creator: "News Pulse",
  publisher: "News Pulse",
  metadataBase: new URL("https://news-alert.vercel.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://news-alert.vercel.app",
    siteName: "News Pulse",
    title: "News Pulse - News Before Its News",
    description: "Monitor breaking news, seismic activity, and geopolitical events from 380+ verified sources worldwide.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "News Pulse - News Before Its News",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "News Pulse - News Before Its News",
    description: "Monitor breaking news, seismic activity, and geopolitical events from 380+ verified sources worldwide.",
    images: ["/og-image.png"],
    creator: "@pulsealert",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Theme initialization script to prevent FOUC
  const themeScript = `
    (function() {
      try {
        const theme = localStorage.getItem('theme');
        if (theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          // Default to dark mode
          document.documentElement.classList.add('dark');
        }
      } catch (e) {
        document.documentElement.classList.add('dark');
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "NYFoodies",
  description:
    "Find restaurants & bars, DM them on Instagram, and track collab deals through your pipeline.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <main className="mx-auto w-full max-w-6xl px-3 pb-24 pt-3 sm:px-4">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800", "900"],
});

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
    <html lang="en" className={`h-full antialiased ${nunito.variable}`}>
      <body className="min-h-full">
        <main className="mx-auto w-full max-w-6xl px-3 pb-24 pt-3 sm:px-4">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}

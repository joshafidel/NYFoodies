import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "NYFoodies — Restaurant Outreach",
  description:
    "Find restaurants & bars, DM them on Instagram, and track collab deals through your pipeline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-border py-4 text-center text-xs text-muted">
          NYFoodies · place data © OpenStreetMap contributors
        </footer>
      </body>
    </html>
  );
}

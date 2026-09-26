import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FLIXO Agent Editor",
  description: "FLIXO browser-first AI image and video editing workspace",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

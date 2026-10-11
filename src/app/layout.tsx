import type { Metadata } from "next";

import Providers from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "AlgoryQR Personel",
  description: "Garson, mutfak ve kurye girişi",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

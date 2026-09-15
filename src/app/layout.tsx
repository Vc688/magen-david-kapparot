import type { Metadata } from "next";
import { Frank_Ruhl_Libre, Inter } from "next/font/google";

import "@/app/globals.css";

const display = Frank_Ruhl_Libre({
  subsets: ["latin", "hebrew"],
  weight: ["500", "700", "900"],
  variable: "--font-display"
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Kapparot | Congregation Magen David of West Deal",
  description:
    "Fulfill the custom of Kapparot online. Appoint the rabbi to perform Kapparot on your behalf and distribute the funds to those in need."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}

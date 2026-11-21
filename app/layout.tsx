import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { wedding } from "@/lib/config";
import "./globals.css";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: `Mariage ${wedding.couple}`,
  description: "Confirmez votre présence",
  robots: { index: false, follow: false }, // site privé : pas de référencement
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}

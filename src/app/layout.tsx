import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { SolanaProvider } from "@/components/wallet";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Sem variável de ambiente dedicada (fora da seção 8 do brief). Troque para
// o domínio de produção quando o deploy estiver definido.
const APP_URL = "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "VERITY. Seu trabalho. Verificado.",
  description:
    "Proof of Contribution: transforme contribuição digital verificável em credencial portátil, associada à sua wallet e verificável por terceiros na Solana.",
  openGraph: {
    title: "VERITY. Seu trabalho. Verificado.",
    description:
      "Proof of Contribution: transforme contribuição digital verificável em credencial portátil, associada à sua wallet e verificável por terceiros na Solana.",
    images: ["/brand/verity-keyvisual.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${outfit.variable} ${inter.variable} antialiased`}>
        <SolanaProvider>
          <ToastProvider>{children}</ToastProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}

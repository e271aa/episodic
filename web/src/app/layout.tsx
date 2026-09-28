import type { Metadata, Viewport } from "next";
import { Archivo, Schibsted_Grotesk, Spline_Sans_Mono } from "next/font/google";
import AutoSync from "@/components/AutoSync";
import BackGesture from "@/components/BackGesture";
import BottomNav from "@/components/BottomNav";
import FirstSync from "@/components/FirstSync";
import PageTransition from "@/components/PageTransition";
import PwaSetup from "@/components/PwaSetup";
import UndoToast from "@/components/UndoToast";
import "./globals.css";

// Tipografia de "sinal de televisão": Archivo é variável no eixo de largura
// (wdth) — usado expandido nos títulos-herói do "A seguir" e condensado
// em rótulos/eyebrows, como um logotipo de canal.
const display = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const body = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

const mono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // O <title> era sempre "Episodic", nos 18 ecrãs (Ronda 12, 5b.4, achado
  // #14) — no separador do browser, no histórico, no seletor de abas do
  // iOS. Cada rota passa a dar o seu próprio `metadata.title`; o molde
  // aqui é o que os põe todos como "X · Episodic".
  title: { default: "Episodic", template: "%s · Episodic" },
  description: "O teu registo de séries — o que viste, o que falta, o que vem a seguir.",
  applicationName: "Episodic",
  appleWebApp: {
    capable: true,
    title: "Episodic",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#101014",
  // permite que o conteúdo respeite as safe areas do iPhone (env(safe-area-inset-*))
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      className={`dark ${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex min-w-0 flex-1 flex-col pb-[calc(var(--dock-h)+0.5rem)]">
          <BackGesture>
            <PageTransition>{children}</PageTransition>
          </BackGesture>
        </div>
        <BottomNav />
        <UndoToast />
        <PwaSetup />
        <AutoSync />
        <FirstSync />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import Script from "next/script";
import AutoSync from "@/components/AutoSync";
import BackGesture from "@/components/BackGesture";
import BottomNav from "@/components/BottomNav";
import FirstSync from "@/components/FirstSync";
import PageTransition from "@/components/PageTransition";
import PwaSetup from "@/components/PwaSetup";
import UndoToast from "@/components/UndoToast";
import { SCRIPT_APARENCIA } from "@/lib/aparencia";
import "./globals.css";

// A letra é a do sistema — SF Pro, SF Mono, SF Rounded (Ronda 14, Mira):
// a app deve parecer ter vindo com o iPhone, e segue o tamanho de texto
// dele (Dynamic Type, em globals.css). Deixam de se carregar as três
// fontes da v2.

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
  // Sem `themeColor` aqui, de propósito: o React/Next voltava a inserir a sua
  // <meta theme-color> ao hidratar, por cima da cor que a Aparência escolheu
  // (medido: 3 metas, a última de volta a #000000 no modo claro). As metas
  // são só do script de aparência (lib/aparencia.ts), que as cria antes do
  // primeiro paint.
  // permite que o conteúdo respeite as safe areas do iPhone (env(safe-area-inset-*))
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `suppressHydrationWarning`: o script da aparência põe `data-theme` no
    // <html> antes de o React chegar — é de propósito, não é um desencontro
    <html lang="pt" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Script id="aparencia" strategy="beforeInteractive">
          {SCRIPT_APARENCIA}
        </Script>
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

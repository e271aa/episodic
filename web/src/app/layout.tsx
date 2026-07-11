import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Spline_Sans_Mono } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import PageTransition from "@/components/PageTransition";
import PwaSetup from "@/components/PwaSetup";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const body = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const mono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Episodic",
  description: "O teu registo de séries — o que viste, o que falta, o que vem a seguir.",
  applicationName: "Episodic",
  appleWebApp: {
    capable: true,
    title: "Episodic",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0e14",
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
        <div className="flex flex-1 flex-col pb-16">
          <PageTransition>{children}</PageTransition>
        </div>
        <BottomNav />
        <PwaSetup />
      </body>
    </html>
  );
}

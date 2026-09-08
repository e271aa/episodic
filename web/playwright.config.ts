import { defineConfig, devices } from "@playwright/test";

/** Porta só dos testes — não colide com o `next dev` de todos os dias. */
const PORTA = 3210;
const BASE = `http://127.0.0.1:${PORTA}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  /** um `.only` esquecido faz o CI passar sem ter corrido nada */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: BASE,
    trace: "on-first-retry",
    /**
     * A app regista um service worker. Em teste ele responderia aos pedidos
     * antes das rotas falsas e o resultado passava a depender do que ficou
     * em cache da corrida anterior.
     */
    serviceWorkers: "block",
  },

  projects: [
    {
      name: "iphone",
      /**
       * A app corre num sítio só: o iPhone do Ruben, em Safari (ou na PWA,
       * que é o mesmo motor). Testar noutro motor seria testar uma app que
       * ninguém usa — por isso WebKit, e não o Chromium por omissão.
       */
      use: { ...devices["iPhone 13"] },
    },
  ],

  webServer: {
    command: `npm run build && npx next start -p ${PORTA}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      /**
       * Sem chaves do Supabase o `proxy.ts` deixa passar tudo: estes testes
       * exercitam a app, não o login.
       *
       * E sem `TMDB_API_KEY` qualquer pedido que escape às rotas falsas
       * responde 503 em vez de ir mesmo à Internet — uma fuga passa a dar
       * erro em vez de passar despercebida (e o CI não precisa de segredos).
       */
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      TMDB_API_KEY: "",
    },
  },
});

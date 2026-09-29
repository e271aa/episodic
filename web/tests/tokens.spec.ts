import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Ronda 12, F3 — cor e tamanhos que a crítica final (B) achou fora dos
 * tokens. Lê o código-fonte: a escala é uma regra do sistema, não do ecrã.
 */
function ficheiros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? ficheiros(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}
const todos = [...ficheiros("src/app"), ...ficheiros("src/components")].filter((f) => !f.endsWith("globals.css"));

test("nenhum texto entre 11 e 12px fora do código (`ep-code`)", () => {
  const maus: string[] = [];
  for (const f of todos)
    readFileSync(f, "utf8")
      .split("\n")
      .forEach((l, i) => {
        if (l.includes("text-[0.6875rem]") && !l.includes("ep-code")) maus.push(`${f}:${i + 1}`);
      });
  expect(maus).toEqual([]);
});

test("nada de 34px inventado, tubo à mão nem preto/branco soltos", () => {
  const padroes = [/2\.125rem/, /#101014/i, /rgba\(16, ?16, ?20/, /bg-black\/60/, /text-white/];
  const maus: string[] = [];
  for (const f of todos.filter((f) => !f.endsWith("manifest.ts") && !f.endsWith("layout.tsx")))
    readFileSync(f, "utf8")
      .split("\n")
      .forEach((l, i) => {
        if (padroes.some((p) => p.test(l))) maus.push(`${f}:${i + 1}`);
      });
  expect(maus).toEqual([]);
});

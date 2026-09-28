/**
 * O aviso de privacidade do Importar — muda consoante haja cloud configurada
 * ou não. Extraído à parte para as duas frases se poderem testar sem
 * precisar de duas builds (Ronda 12, Fase 5e, achado #14): "nada é enviado
 * para servidores" era dito sempre, mas é falso com a cloud ligada — a
 * próxima sincronização envia tudo (`importExport`, em `db.ts`).
 */
export function avisoDePrivacidade(cloudConfigured: boolean): string {
  return cloudConfigured
    ? "Tudo é processado aqui no teu aparelho — sobe para a tua conta se tiveres sessão iniciada."
    : "Tudo é processado aqui no teu aparelho; nada é enviado para servidores.";
}

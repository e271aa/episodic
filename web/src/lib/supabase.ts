// Cliente Supabase (browser). As chaves são públicas por design (a segurança
// vem da Row Level Security no servidor, não do segredo da anon key).
// Se não estiverem configuradas, `supabase` é null e a app funciona 100% local.
//
// Usa `@supabase/ssr` e não o `createClient` normal: a sessão fica em cookies
// em vez de localStorage, o que permite ao `proxy.ts` (servidor) saber se há
// sessão *antes* de renderizar — é isso que torna possível proteger as rotas.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createBrowserClient(url, anonKey) : null;

export function isCloudConfigured(): boolean {
  return supabase !== null;
}

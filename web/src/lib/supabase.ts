// Cliente Supabase (browser). As chaves são públicas por design (a segurança
// vem da Row Level Security no servidor, não do segredo da anon key).
// Se não estiverem configuradas, `supabase` é null e a app funciona 100% local.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true, // completa o magic-link ao voltar ao site
        },
      })
    : null;

export function isCloudConfigured(): boolean {
  return supabase !== null;
}

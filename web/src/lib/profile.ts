// O perfil do utilizador na cloud (nome, avatar, série e personagem
// favoritas). Ao contrário da biblioteca, isto não vive em IndexedDB: é
// pequeno, muda raramente, e faz sentido ser a cloud a mandar — é o mesmo
// "cartão" em todos os dispositivos.
import { supabase } from "./supabase";
import { getUser } from "./cloud";

export interface UserProfile {
  displayName: string | null;
  avatarUrl: string | null;
  favoriteShowUuid: string | null;
  favoriteCharacter: string | null;
  favoriteActor: string | null;
  favoritePersonImg: string | null;
}

interface ProfileRow {
  display_name: string | null;
  avatar_url: string | null;
  favorite_show_uuid: string | null;
  favorite_character: string | null;
  favorite_actor: string | null;
  favorite_person_img: string | null;
}

const rowToProfile = (r: ProfileRow): UserProfile => ({
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  favoriteShowUuid: r.favorite_show_uuid,
  favoriteCharacter: r.favorite_character,
  favoriteActor: r.favorite_actor,
  favoritePersonImg: r.favorite_person_img,
});

export const EMPTY_PROFILE: UserProfile = {
  displayName: null,
  avatarUrl: null,
  favoriteShowUuid: null,
  favoriteCharacter: null,
  favoriteActor: null,
  favoritePersonImg: null,
};

export async function getProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "display_name, avatar_url, favorite_show_uuid, favorite_character, favorite_actor, favorite_person_img",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToProfile(data as ProfileRow);
}

export async function saveProfile(patch: Partial<UserProfile>): Promise<{ error?: string }> {
  if (!supabase) return { error: "Cloud não configurada." };
  const user = await getUser();
  if (!user) return { error: "Sem sessão iniciada." };

  const row: Record<string, unknown> = { id: user.id, updated_at: new Date().toISOString() };
  if ("displayName" in patch) row.display_name = patch.displayName;
  if ("avatarUrl" in patch) row.avatar_url = patch.avatarUrl;
  if ("favoriteShowUuid" in patch) row.favorite_show_uuid = patch.favoriteShowUuid;
  if ("favoriteCharacter" in patch) row.favorite_character = patch.favoriteCharacter;
  if ("favoriteActor" in patch) row.favorite_actor = patch.favoriteActor;
  if ("favoritePersonImg" in patch) row.favorite_person_img = patch.favoritePersonImg;

  const { error } = await supabase.from("profiles").upsert(row);
  return error ? { error: error.message } : {};
}

/** Limites do avatar — o upload é do utilizador, não de um fornecedor. */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const TIPOS_ACEITES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadAvatar(file: File): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: "Cloud não configurada." };
  const user = await getUser();
  if (!user) return { error: "Sem sessão iniciada." };
  if (!TIPOS_ACEITES.includes(file.type)) {
    return { error: "Usa uma imagem JPEG, PNG ou WebP." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "A imagem é maior que 5 MB." };
  }

  // O caminho TEM de começar pelo id do utilizador — é o que a política de
  // segurança do bucket verifica. O sufixo temporal evita ficar preso à
  // cache do browser depois de trocar de foto.
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) return { error: upErr.message };

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = data.publicUrl;
  const saved = await saveProfile({ avatarUrl: url });
  if (saved.error) return { error: saved.error };
  return { url };
}

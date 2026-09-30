"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getShows, type StoredShow } from "@/lib/db";
import EscolhaPersonagem, { type PersonagemEscolhida } from "@/components/EscolhaPersonagem";
import {
  EMPTY_PROFILE,
  getProfile,
  saveProfile,
  uploadAvatar,
  type UserProfile,
} from "@/lib/profile";
import { isCloudConfigured } from "@/lib/supabase";

/**
 * A identidade do perfil (nome, foto, série e personagem favoritas), lida da
 * nuvem. Sem nuvem não há perfil: `perfil` fica `null` e o Perfil mostra uma
 * linha sem nome. O editor abre-se nas Definições.
 */
export function useIdentidade() {
  const [perfil, setPerfil] = useState<UserProfile | null>(null);
  const [shows, setShows] = useState<StoredShow[]>([]);

  // Promise.all devolve antes de qualquer setState — assim o estado só muda
  // dentro do callback assíncrono, nunca no corpo do efeito.
  const recarregar = useCallback(
    () =>
      Promise.all([getProfile(), getShows()]).then(([p, s]) => {
        setPerfil(p ?? (isCloudConfigured() ? EMPTY_PROFILE : null));
        setShows(s);
      }),
    [],
  );

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { perfil, shows, recarregar };
}

export function EditorPerfil({
  perfil,
  shows,
  onFechar,
  onGuardado,
}: {
  perfil: UserProfile;
  shows: StoredShow[];
  onFechar: () => void;
  onGuardado: () => void;
}) {
  const [nome, setNome] = useState(perfil.displayName ?? "");
  const [showUuid, setShowUuid] = useState(perfil.favoriteShowUuid ?? "");
  const [personagem, setPersonagem] = useState<PersonagemEscolhida | null>(
    perfil.favoriteCharacter
      ? {
          character: perfil.favoriteCharacter,
          actorName: perfil.favoriteActor,
          profilePath: perfil.favoritePersonImg,
        }
      : null,
  );
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ficheiro = useRef<HTMLInputElement>(null);

  // Todas as séries arquivadas de fora, sem exigir tmdbId — exigir tmdbId
  // deixava de fora quase a biblioteca toda, e o menu ficava com uma meia
  // dúzia de opções em vez das dezenas que a pessoa realmente segue.
  const seriesOrdenadas = [...shows]
    .filter((s) => !s.archived)
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));

  const guardar = async () => {
    setAGuardar(true);
    setErro(null);
    const { error } = await saveProfile({
      displayName: nome.trim() || null,
      favoriteShowUuid: showUuid || null,
      favoriteCharacter: personagem?.character ?? null,
      favoriteActor: personagem?.actorName ?? null,
      favoritePersonImg: personagem?.profilePath ?? null,
    });
    setAGuardar(false);
    if (error) {
      setErro(error);
      return;
    }
    onGuardado();
    onFechar();
  };

  const escolherFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAGuardar(true);
    setErro(null);
    const { error } = await uploadAvatar(file);
    setAGuardar(false);
    if (error) setErro(error);
    else onGuardado();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-tube/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-5 py-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Editar perfil</h2>
          <button
            onClick={onFechar}
            className="min-h-11 cursor-pointer text-[0.9375rem] text-dim transition hover:text-ink"
          >
            Cancelar
          </button>
        </div>

        <label className="mt-6 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-dim">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como queres aparecer"
            maxLength={40}
            className="min-h-12 rounded-2xl border border-line bg-panel px-4 outline-none transition-colors focus:border-ink"
          />
        </label>

        <div className="mt-4">
          <p className="text-xs font-medium text-dim">Foto de perfil</p>
          <input
            ref={ficheiro}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void escolherFoto(e)}
            className="hidden"
          />
          <button
            onClick={() => ficheiro.current?.click()}
            disabled={aGuardar}
            className="mt-1.5 min-h-11 w-full cursor-pointer rounded-2xl border border-line text-[0.9375rem] font-semibold text-dim transition hover:border-ink hover:text-ink disabled:opacity-50"
          >
            {perfil.avatarUrl ? "Trocar foto" : "Escolher foto"}
          </button>
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-dim">Série favorita</span>
          <select
            value={showUuid}
            onChange={(e) => setShowUuid(e.target.value)}
            className="min-h-12 cursor-pointer rounded-2xl border border-line bg-panel px-4 outline-none transition-colors focus:border-ink"
          >
            <option value="">Nenhuma</option>
            {seriesOrdenadas.map((s) => (
              <option key={s.uuid} value={s.uuid}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-6">
          <EscolhaPersonagem
            shows={shows}
            favoritaUuid={showUuid}
            atual={personagem}
            onEscolher={setPersonagem}
          />
        </div>

        {erro && (
          <p className="page-enter mt-4 text-[0.9375rem] text-danger" role="alert">
            {erro}
          </p>
        )}

        <button
          onClick={() => void guardar()}
          disabled={aGuardar}
          className="mt-6 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink font-semibold text-tube transition hover:brightness-110 disabled:opacity-50"
        >
          {aGuardar && (
            <span className="spinner h-4 w-4 rounded-full border-2 border-tube/30 border-t-tube" />
          )}
          {aGuardar ? "A guardar…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

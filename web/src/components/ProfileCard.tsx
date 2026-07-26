"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getShows, type StoredShow } from "@/lib/db";
import { getSeriesCast, type CastMember } from "@/lib/tmdb";
import {
  EMPTY_PROFILE,
  getProfile,
  saveProfile,
  uploadAvatar,
  type UserProfile,
} from "@/lib/profile";
import { isCloudConfigured } from "@/lib/supabase";
import Poster from "@/components/Poster";
import { CheckIcon, UserIcon } from "@/components/icons";
import { Bone } from "@/components/Skeleton";

/**
 * O cartão de identidade do perfil: capa da série favorita, avatar, nome e
 * personagem favorita. É a primeira coisa que se vê no Perfil — as
 * estatísticas vêm depois.
 */
export default function ProfileCard() {
  const [perfil, setPerfil] = useState<UserProfile | null>(null);
  const [shows, setShows] = useState<StoredShow[]>([]);
  const [aEditar, setAEditar] = useState(false);

  // Promise.all devolve antes de qualquer setState — assim o estado só muda
  // dentro do callback assíncrono, nunca no corpo do efeito.
  const recarregar = useCallback(
    () =>
      Promise.all([getProfile(), getShows()]).then(([p, s]) => {
        setPerfil(p ?? EMPTY_PROFILE);
        setShows(s);
      }),
    [],
  );

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  if (!isCloudConfigured() || !perfil) return null;

  const favorita = shows.find((s) => s.uuid === perfil.favoriteShowUuid) ?? null;
  const nome = perfil.displayName?.trim() || "Sem nome";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-panel">
      {/* Capa = subcapa da série favorita. Sem favorita, fica o gradiente
          neutro — nunca um retângulo vazio que pareça imagem em falta. */}
      <div className="relative h-32 sm:h-40">
        {favorita?.backdropPath ? (
          <>
            <Poster
              path={favorita.backdropPath}
              alt=""
              size="w780"
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/50 to-transparent" />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-raised to-panel" />
        )}
        <div className="bars absolute inset-x-0 top-0 h-[3px]" />
      </div>

      <div className="px-5 pb-5">
        <div className="-mt-10 flex items-end gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-panel bg-raised shadow-lg">
            {perfil.avatarUrl ? (
              <Image
                src={perfil.avatarUrl}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-faint">
                <UserIcon className="h-8 w-8" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="truncate font-display text-xl font-bold leading-tight">{nome}</p>
            {perfil.favoriteCharacter && (
              <p className="ep-code mt-0.5 truncate text-xs text-dim">
                {perfil.favoriteCharacter}
                {perfil.favoriteActor ? ` · ${perfil.favoriteActor}` : ""}
              </p>
            )}
          </div>
          {perfil.favoritePersonImg && (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-md">
              <Poster
                path={perfil.favoritePersonImg}
                alt={perfil.favoriteCharacter ?? ""}
                size="w185"
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
          )}
        </div>

        <button
          onClick={() => setAEditar(true)}
          className="mt-4 min-h-11 w-full cursor-pointer rounded-full border border-line text-sm font-semibold text-dim transition hover:border-ink hover:text-ink"
        >
          Editar perfil
        </button>
      </div>

      {aEditar && (
        <EditorPerfil
          perfil={perfil}
          shows={shows}
          onFechar={() => setAEditar(false)}
          onGuardado={() => void recarregar()}
        />
      )}
    </section>
  );
}

function EditorPerfil({
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
  // guarda a que série pertence o elenco: trocar de série mostra o esqueleto
  // sem precisar de repor o estado dentro do efeito
  const [elencoDe, setElencoDe] = useState<{ tmdbId: number; cast: CastMember[] } | null>(
    null,
  );
  const [personagem, setPersonagem] = useState(perfil.favoriteCharacter ?? "");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ficheiro = useRef<HTMLInputElement>(null);

  // séries com tmdbId primeiro: só essas conseguem trazer elenco
  const seriesOrdenadas = [...shows]
    .filter((s) => s.tmdbId)
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));

  const escolhida = shows.find((s) => s.uuid === showUuid);

  const tmdbId = escolhida?.tmdbId ?? null;

  useEffect(() => {
    if (!tmdbId) return;
    let vivo = true;
    void getSeriesCast(tmdbId)
      .then((c) => {
        if (vivo) setElencoDe({ tmdbId, cast: c.slice(0, 24) });
      })
      .catch(() => {
        if (vivo) setElencoDe({ tmdbId, cast: [] });
      });
    return () => {
      vivo = false;
    };
  }, [tmdbId]);

  /** null enquanto o elenco desta série não chegou */
  const elenco = elencoDe && elencoDe.tmdbId === tmdbId ? elencoDe.cast : null;

  const guardar = async () => {
    setAGuardar(true);
    setErro(null);
    const escolhido = elenco?.find((c) => c.character === personagem);
    const { error } = await saveProfile({
      displayName: nome.trim() || null,
      favoriteShowUuid: showUuid || null,
      favoriteCharacter: personagem || null,
      favoriteActor: escolhido?.actorName ?? null,
      favoritePersonImg: escolhido?.profilePath ?? null,
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
            className="min-h-11 cursor-pointer text-sm text-dim transition hover:text-ink"
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
            className="mt-1.5 min-h-11 w-full cursor-pointer rounded-2xl border border-line text-sm font-semibold text-dim transition hover:border-ink hover:text-ink disabled:opacity-50"
          >
            {perfil.avatarUrl ? "Trocar foto" : "Escolher foto"}
          </button>
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-dim">Série favorita</span>
          <select
            value={showUuid}
            onChange={(e) => {
              setShowUuid(e.target.value);
              setPersonagem("");
            }}
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

        {escolhida && (
          <div className="mt-4">
            <p className="text-xs font-medium text-dim">Personagem favorita</p>
            {elenco === null ? (
              <div className="mt-2 flex gap-2 overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                  <Bone key={i} className="h-24 w-16 shrink-0 rounded-xl" />
                ))}
              </div>
            ) : elenco.length === 0 ? (
              <p className="mt-1.5 text-sm text-dim">
                Não foi possível carregar o elenco desta série.
              </p>
            ) : (
              <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-2">
                {elenco.map((c) => {
                  const ativo = personagem === c.character;
                  return (
                    <button
                      key={`${c.personId}-${c.character}`}
                      onClick={() => setPersonagem(ativo ? "" : c.character)}
                      className={`w-16 shrink-0 cursor-pointer text-left transition active:scale-95 ${
                        ativo ? "" : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div
                        className={`relative h-24 w-16 overflow-hidden rounded-xl bg-raised ${
                          ativo ? "ring-2 ring-ink" : ""
                        }`}
                      >
                        {c.profilePath ? (
                          <Poster
                            path={c.profilePath}
                            alt={c.character}
                            size="w185"
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-faint">
                            <UserIcon className="h-5 w-5" />
                          </span>
                        )}
                        {ativo && (
                          <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-tube">
                            <CheckIcon className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[11px] font-medium">{c.character}</p>
                      <p className="ep-code truncate text-[10px] text-faint">{c.actorName}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {erro && (
          <p className="page-enter mt-4 text-sm text-danger" role="alert">
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

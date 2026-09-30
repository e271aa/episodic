"use client";

import { useCallback, useEffect, useState } from "react";
import { clearAllData, getImportMeta } from "@/lib/db";
import { porExtenso } from "@/lib/datas";
import { EMPTY_PROFILE } from "@/lib/profile";
import { isCloudConfigured } from "@/lib/supabase";
import CabecalhoEcra from "@/components/CabecalhoEcra";
import CloudAccount from "@/components/CloudAccount";
import IntegrityCheck from "@/components/IntegrityCheck";
import { EditorPerfil, useIdentidade } from "@/components/ProfileCard";
import EscolhaAparencia from "@/components/mira/EscolhaAparencia";
import { Grupo, Linha } from "@/components/mira/Grupo";
import { Panel, PanelRow } from "@/components/Panel";

/**
 * Perfil › Definições (B·5): o que se mexe raramente — o perfil, a aparência,
 * a conta e os dados. Sai do Perfil para este ficar só com o «quanto já vi?».
 */
export default function DefinicoesPage() {
  // `undefined` = ainda a ler; `null` = nunca se importou
  const [importadoEm, setImportadoEm] = useState<string | null | undefined>(undefined);
  const [confirmClear, setConfirmClear] = useState(false);
  const [aEditar, setAEditar] = useState(false);
  const { perfil, shows, recarregar } = useIdentidade();

  const lerImportacao = useCallback(
    () => getImportMeta().then((m) => setImportadoEm(m?.importedAt ?? null)),
    [],
  );
  useEffect(() => {
    void lerImportacao();
  }, [lerImportacao]);

  // A confirmação é um estado do painel, não um segundo clique no mesmo
  // botão: "clica outra vez" obrigava a ler o botão que se acabou de premir.
  const handleClear = useCallback(async () => {
    await clearAllData();
    setConfirmClear(false);
    await lerImportacao();
  }, [lerImportacao]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-6">
      <CabecalhoEcra titulo="Definições" voltar="Voltar ao perfil" fallback="/profile" />

      {isCloudConfigured() && perfil && (
        <Grupo className="mt-4">
          <Linha
            titulo="Editar perfil"
            subtitulo="Nome, foto, série e personagem favoritas"
            onClick={() => setAEditar(true)}
            chevron
            alta
          />
        </Grupo>
      )}

      <section className="mt-6">
        <h2 className="mb-2 px-1 text-base font-semibold text-label">Aparência</h2>
        <EscolhaAparencia />
      </section>

      <CloudAccount onSynced={() => void lerImportacao()} />

      <section className="mt-8">
        <h2 className="mb-2 px-1 text-base font-semibold text-label">Dados</h2>
        <Panel>
          <PanelRow
            titulo="Importar do TV Time"
            detalhe={
              importadoEm ? `Última importação a ${porExtenso(importadoEm)}` : "Traz o histórico do export GDPR"
            }
            href="/import"
            fim="→"
          />
          {/* Duas coisas diferentes, de propósito em linhas separadas: o que
              só tu sabes (se viste uma série) e o que a app sabe que está
              mal (repetidos, episódios contados duas vezes). */}
          <PanelRow
            titulo="Rever a biblioteca"
            detalhe="Séries atrás do que já estreou — só tu sabes se as viste"
            href="/rever"
            fim="→"
          />
          <IntegrityCheck />
          {/* O vermelho só acende quando a destruição está mesmo a um toque.
              Em repouso é uma linha como as outras — a app tem um único
              acento de perigo e não pode estar sempre ligado, ou deixa de
              querer dizer alguma coisa. */}
          {confirmClear ? (
            <div className="px-4 py-3.5">
              <p className="text-base font-semibold text-danger">Apagar tudo o que está neste dispositivo?</p>
              <p className="mt-0.5 text-[0.88rem] text-label-2">
                Séries, filmes, episódios marcados e listas. Não há como voltar atrás{" "}
                {importadoEm ? "— terias de importar o TV Time outra vez." : "daqui."}
              </p>
              <div className="mt-3 flex gap-2">
                {/* text-tube e não text-ink: branco sobre o vermelho dá 3,3:1,
                    abaixo do mínimo para 15px. */}
                <button
                  onClick={() => void handleClear()}
                  className="min-h-11 flex-1 cursor-pointer rounded-full bg-danger px-4 text-[0.9375rem] font-semibold text-tube transition hover:brightness-110 active:scale-95"
                >
                  Apagar tudo
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="min-h-11 flex-1 cursor-pointer rounded-full bg-fill-strong px-4 text-[0.9375rem] font-semibold text-label transition active:scale-95"
                >
                  Manter
                </button>
              </div>
            </div>
          ) : (
            // Sem `perigo`: em repouso é uma linha como as outras — o
            // vermelho só acende no painel de confirmação, acima.
            <PanelRow
              titulo="Apagar dados locais"
              detalhe="Limpa esta cópia — a da cloud, se tiveres sessão, fica"
              onClick={() => setConfirmClear(true)}
            />
          )}
        </Panel>
      </section>

      {/* Temporário (Ronda 14, Fase 11): a PWA instalada não tem barra de
          endereço, e é lá que se lê a área segura e a barra de estado. Sai com a
          vitrine `/mira` na Fase 12. */}
      <section className="mt-8">
        <h2 className="mb-2 px-1 text-base font-semibold text-label">Diagnóstico</h2>
        <Panel>
          <PanelRow
            titulo="Diagnóstico do ecrã"
            detalhe="Área segura, barra de estado, texto do sistema — para testar a PWA"
            href="/diagnostico"
            fim="→"
          />
        </Panel>
      </section>

      <p className="mt-10 text-center text-xs leading-relaxed text-faint">
        Episodic — os teus dados vivem neste dispositivo
        <br />e na cloud, se iniciares sessão.
        <br />
        Metadados por TVmaze e TMDB.
      </p>

      {aEditar && (
        <EditorPerfil
          perfil={perfil ?? EMPTY_PROFILE}
          shows={shows}
          onFechar={() => setAEditar(false)}
          onGuardado={() => void recarregar()}
        />
      )}
    </main>
  );
}

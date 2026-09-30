"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BotaoVoltar from "@/components/BotaoVoltar";
import CabecalhoEcra from "@/components/CabecalhoEcra";
import {
  addToList,
  deleteList,
  removeFromList,
  renameList,
  restoreList,
  type CustomList,
} from "@/lib/db";
import { pushUndo } from "@/lib/undo";
import { recursoListas, useFilmes, useListas, useSeries } from "@/lib/cache";
import Cartaz from "@/components/mira/Cartaz";
import Acao from "@/components/mira/Acao";
import { X } from "lucide-react";
import { PosterGridBone, TitleBone } from "@/components/Skeleton";

interface ResolvedItem {
  kind: "show" | "movie";
  refId: string;
  href: string;
  name: string;
  posterPath: string | null;
}

export default function ListaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  // Tudo o que esta página mostra vem das caches: ao voltar de um item, o
  // conteúdo já cá está e o documento tem a altura toda a tempo de o
  // browser repor o scroll. Antes, as 24 leituras ao IndexedDB (uma por
  // item) faziam a página voltar vazia — e a posição perdia-se.
  const listas = useListas();
  const series = useSeries();
  const filmes = useFilmes();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // `undefined` = ainda a carregar; `null` = carregou e esta lista não existe
  const list: CustomList | null | undefined =
    listas === null ? undefined : (listas.find((l) => l.id === id) ?? null);

  const items: ResolvedItem[] = useMemo(() => {
    if (!list || !series || !filmes) return [];
    const porUuid = new Map(series.map((s) => [s.uuid, s]));
    const porChave = new Map(filmes.map((m) => [m.key, m]));
    return list.items.flatMap((item): ResolvedItem[] => {
      if (item.kind === "show") {
        const show = porUuid.get(item.refId);
        if (!show) return [];
        return [{
          kind: "show",
          refId: item.refId,
          href: `/series/${item.refId}`,
          name: show.name,
          posterPath: show.posterPath,
        }];
      }
      const movie = porChave.get(item.refId);
      if (!movie) return [];
      return [{
        kind: "movie",
        refId: item.refId,
        href: `/movies/${item.refId}`,
        name: movie.name,
        posterPath: movie.posterPath ?? null,
      }];
    });
  }, [list, series, filmes]);

  // O campo de edição arranca do nome guardado no momento em que se entra
  // em edição — sem efeito a sincronizá-lo, que era o que o
  // `set-state-in-effect` apanhava (e com razão: fora da edição este
  // estado não tem de existir).
  const comecarAEditar = useCallback(() => {
    setName(list?.name ?? "");
    setEditingName(true);
  }, [list]);

  const handleRename = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || !list) return;
    await renameList(list.id, trimmed);
    setEditingName(false);
    await recursoListas.revalidar();
  }, [name, list]);

  const handleDelete = useCallback(async () => {
    if (!list) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    // Cópia antes de apagar: é o que a anulação repõe, com o mesmo id e as
    // mesmas datas. Toda a app anula o que destrói — marcar episódios,
    // dispensar no Explorar — menos as duas ações que destruíam a sério.
    const copia: CustomList = { ...list, items: [...list.items] };
    await deleteList(list.id);
    await recursoListas.revalidar();
    // A anulação regista-se ANTES de navegar: a seguir ao `push` esta página
    // desmonta, e o `pushUndo` chegava tarde de mais para o aviso aparecer.
    pushUndo({
      label: "Lista apagada",
      // apagar uma lista fecha a página dela à força — sem isto, a navegação
      // que a própria ação provoca levava a anulação com ela
      atravessaUmEcra: true,
      detail: `${copia.name} · ${copia.items.length} ${copia.items.length === 1 ? "item" : "itens"}`,
      undo: async () => {
        await restoreList(copia);
        await recursoListas.revalidar();
      },
    });
    // Direto ao separador das Listas, não a `/listas`: essa rota reencaminha
    // (Ronda 12, Fase 5b.3), o que eram DOIS ecrãs de caminho — e o aviso
    // de anular só atravessa um. Medido: desaparecia antes de se ver.
    router.push("/library?tipo=listas");
  }, [list, confirmDelete, router]);

  const handleRemoveItem = useCallback(
    async (item: ResolvedItem) => {
      if (!list) return;
      await removeFromList(list.id, item.kind, item.refId);
      await recursoListas.revalidar();
      pushUndo({
        label: "Removido da lista",
        detail: item.name,
        undo: async () => {
          await addToList(list.id, item.kind, item.refId);
          await recursoListas.revalidar();
        },
      });
    },
    [list],
  );

  if (list === undefined) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <TitleBone />
        <PosterGridBone />
      </main>
    );
  }

  if (list === null) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-label-2">Lista não encontrada.</p>
        <BotaoVoltar
          label="Voltar às listas"
          fallback="/listas"
          className="mt-4 inline-block cursor-pointer text-label underline"
        >
          Voltar às listas
        </BotaoVoltar>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <CabecalhoEcra
        voltar="Voltar às listas"
        fallback="/listas"
        titulo={
          editingName ? (
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleRename();
            }}
          >
            <input
              autoFocus
              aria-label="Nome da lista"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-full bg-fill px-4 text-lg font-semibold text-label outline-none"
            />
            <Acao type="submit" grande={false}>
              Guardar
            </Acao>
          </form>
        ) : (
          // O título renomeia-se ao toque — por isso é um botão dentro do
          // <h1>, não um <h1> com onClick, que o teclado e o VoiceOver não
          // alcançavam (Ronda 12, Fase 4).
          <h1 className="min-w-0 text-[1.65rem] leading-[1.1] font-bold text-label">
            <button
              onClick={comecarAEditar}
              aria-label={`Renomear a lista ${list.name}`}
              title="Toca para renomear"
              // O texto por si só tinha ~32px de alto — `tap-44` estica a
              // área de toque para os 44px sem alargar o que se vê.
              className="tap-44 relative cursor-pointer text-left"
            >
              {list.name}
            </button>
          </h1>
          )
        }
      />
      <p className="mt-1 text-[0.76rem] text-label-2">
        <span className="ep-code">{items.length}</span> {items.length === 1 ? "item" : "itens"}
      </p>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-[0.88rem] text-label-2">
          Sem itens ainda — adiciona séries e filmes a partir da página de cada um.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5">
          {items.map((item, i) => (
            <Cartaz
              key={`${item.kind}-${item.refId}`}
              href={item.href}
              nome={item.name}
              capa={item.posterPath}
              indice={i}
              // O ✗ é vidro no canto da capa, sempre à vista: num ecrã tátil
              // não há hover (Ronda 12, Fase 4). `preventDefault`: o botão
              // vive dentro da ligação do cartaz.
              acao={{
                aria: `Remover ${item.name} da lista`,
                icon: <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2.6} />,
                onClick: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleRemoveItem(item);
                },
              }}
            />
          ))}
        </div>
      )}

      {/* O vermelho só acende quando a destruição está mesmo a um toque —
          a mesma regra do "Apagar dados locais" no Perfil (Ronda 12, Fase 4,
          achado #17). Em repouso é uma linha como as outras. */}
      <Acao
        tipo="secundaria"
        grande={false}
        onClick={() => void handleDelete()}
        className={`mt-10 ${confirmDelete ? "text-danger!" : "text-label-2!"}`}
      >
        {confirmDelete ? "Tens a certeza? Toca outra vez para apagar" : "Apagar lista"}
      </Acao>
    </main>
  );
}

"use client";

import { CardsIcon, GridIcon } from "@/components/icons";

export type Modo = "cartoes" | "grelha";

export const MODOS: readonly Modo[] = ["cartoes", "grelha"];

/**
 * Escolha de *apresentação*, não de conteúdo. Por isso é menor, sem rótulos
 * e à direita do título — subordinada ao filtro Séries/Filmes, que fica com
 * a barra de pílulas só para ele.
 *
 * 36px de altura visual, 44px de alvo via `.tap-44` em cada botão.
 */
export default function ViewModeToggle({
  modo,
  onChange,
}: {
  modo: Modo;
  onChange: (m: Modo) => void;
}) {
  const opcoes = [
    { id: "cartoes" as const, label: "Ver em cartões, um a um", Icon: CardsIcon },
    { id: "grelha" as const, label: "Ver em grelha, tudo à vista", Icon: GridIcon },
  ];

  return (
    <div
      role="group"
      aria-label="Modo de visualização"
      className="flex items-center gap-0.5 rounded-full border border-line bg-panel/80 p-[3px]"
    >
      {opcoes.map(({ id, label, Icon }) => {
        const ativo = modo === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={ativo}
            aria-label={label}
            title={label}
            className={`tap-44 relative flex h-[30px] w-9 cursor-pointer items-center justify-center rounded-full transition-colors ${
              ativo ? "bg-ink text-tube" : "text-faint hover:text-ink"
            }`}
          >
            <Icon className="h-[15px] w-[15px]" />
          </button>
        );
      })}
    </div>
  );
}

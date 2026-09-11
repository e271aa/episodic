// Pilha de anulação. A ação acontece já — o arrependimento é que ganha uma
// segunda hipótese. Nada de "tens a certeza?": confirmar castiga toda a gente
// pelo engano de uma vez, anular não castiga ninguém.
//
// É uma pilha e não um aviso único de propósito: marcar cinco episódios
// seguidos no "Pôr em dia" tem de poder recuar cinco vezes, pela ordem inversa.

export interface UndoEntry {
  id: number;
  /** o que aconteceu, ex. "Episódio marcado como visto" */
  label: string;
  /** o alvo concreto, ex. "Friends · S01·E21" */
  detail?: string;
  undo: () => void | Promise<void>;
  /** momento (ms) em que deixa de se poder anular */
  expiresAt: number;
  /**
   * Sobrevive a **uma** mudança de ecrã.
   *
   * A regra normal é o contrário — mudar de ecrã fecha a janela, porque
   * anular o que já não está à vista é desfazer às cegas. Mas há ações em que
   * a navegação **é** a consequência: apagar uma lista fecha a página da
   * lista, à força. Aí fechar a janela tirava a anulação exatamente a quem
   * mais precisa dela. Vale uma travessia, não mais: à segunda já se anda
   * noutro sítio.
   */
  atravessaUmEcra?: boolean;
}

/** Janela para mudar de ideias. O Gmail usa 10s no envio; marcar um episódio
 *  percebe-se mais depressa que isso. */
export const GRACE_MS = 7000;

let stack: UndoEntry[] = [];
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const listeners = new Set<(entries: UndoEntry[]) => void>();

function emit(): void {
  for (const listener of listeners) listener(stack);
}

function drop(id: number): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  stack = stack.filter((e) => e.id !== id);
}

export function subscribeUndo(fn: (entries: UndoEntry[]) => void): () => void {
  listeners.add(fn);
  fn(stack);
  return () => {
    listeners.delete(fn);
  };
}

export function pushUndo(entry: {
  label: string;
  detail?: string;
  undo: () => void | Promise<void>;
  atravessaUmEcra?: boolean;
}): void {
  const id = nextId++;
  stack = [...stack, { ...entry, id, expiresAt: Date.now() + GRACE_MS }];
  timers.set(
    id,
    setTimeout(() => {
      drop(id);
      emit();
    }, GRACE_MS),
  );
  emit();
}

/** Anula a ação mais recente que ainda esteja dentro da janela. */
export function undoLast(): void {
  const entry = stack[stack.length - 1];
  if (!entry) return;
  drop(entry.id);
  emit();
  void entry.undo();
}

/**
 * Fecha a janela de anulação. Quem foi marcado com `atravessaUmEcra`
 * sobrevive a esta — e só a esta: perde a marca, portanto a mudança de ecrã
 * seguinte já o leva.
 */
export function dismissAll(): void {
  const sobrevivem = stack.filter((e) => e.atravessaUmEcra);
  for (const entry of stack) {
    if (!entry.atravessaUmEcra) drop(entry.id);
  }
  stack = sobrevivem.map((e) => ({ ...e, atravessaUmEcra: false }));
  emit();
}

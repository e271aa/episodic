"use client";

import SectionHeader from "@/components/SectionHeader";

/**
 * A ordem tem de estar sempre à vista — dizer "A–Z" ou "Vistos há pouco" em
 * texto resolve a dúvida sem ser preciso abrir nada; o ícone só muda.
 *
 * O `-mx-5 px-5` desfaz e refaz o padding horizontal do contentor — pressupõe
 * que quem o usa tem exatamente esse padding (hoje só a Biblioteca).
 */
export default function StickySectionHeader({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-5 mb-2 mt-5 bg-tube/90 px-5 py-2 backdrop-blur">
      <SectionHeader label={label} meta={count} color={color} />
    </div>
  );
}

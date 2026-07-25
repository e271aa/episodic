"use client";

import { useEffect } from "react";
import { startAutoSync } from "@/lib/autosync";

// Liga o envio automático para a cloud assim que a app arranca — trata do que
// ficou pendente de sessões anteriores (ex.: marcado offline no telemóvel).
export default function AutoSync() {
  useEffect(() => {
    startAutoSync();
  }, []);
  return null;
}

import { useSyncExternalStore } from "react";
import type { ColumnMapping, RawTable } from "./parse";
import type { TxnType } from "./merchants";

export interface StagedTxn {
  id: string;
  date: string;
  description: string;
  merchant: string;
  merchantKey: string;
  amount: number;
  type: TxnType;
  categoryPath: string;
  confidence: number;
  source: "user-rule" | "built-in" | "fallback" | "manual";
  excluded: boolean;
  remember: boolean;
}

export interface StagedImport {
  fileName: string;
  fileType: string;
  bankGuess?: string;
  accountMask?: string;
  table: RawTable;
  mapping: ColumnMapping;
  rows: StagedTxn[];
}

let state: StagedImport | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const importStore = {
  set(next: StagedImport | null) {
    state = next;
    emit();
  },
  get() {
    return state;
  },
  updateRows(updater: (rows: StagedTxn[]) => StagedTxn[]) {
    if (!state) return;
    state = { ...state, rows: updater(state.rows) };
    emit();
  },
  clear() {
    state = null;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useStagedImport() {
  return useSyncExternalStore(
    importStore.subscribe,
    () => state,
    () => null,
  );
}

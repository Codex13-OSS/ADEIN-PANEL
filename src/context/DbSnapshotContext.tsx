import { createContext, useContext, useMemo, useState } from 'react';
import { DbDashboardSnapshot } from '../types/dbSnapshot';

type DbSnapshotContextValue = {
  appliedSnapshot: DbDashboardSnapshot | null;
  applySnapshot: (snapshot: DbDashboardSnapshot) => void;
  clearSnapshot: () => void;
};

const DbSnapshotContext = createContext<DbSnapshotContextValue | undefined>(undefined);

export function DbSnapshotProvider({ children }: { children: React.ReactNode }) {
  const [appliedSnapshot, setAppliedSnapshot] = useState<DbDashboardSnapshot | null>(null);

  const value = useMemo<DbSnapshotContextValue>(() => ({
    appliedSnapshot,
    applySnapshot: (snapshot) => setAppliedSnapshot(snapshot),
    clearSnapshot: () => setAppliedSnapshot(null),
  }), [appliedSnapshot]);

  return <DbSnapshotContext.Provider value={value}>{children}</DbSnapshotContext.Provider>;
}

export function useDbSnapshot() {
  const context = useContext(DbSnapshotContext);
  if (!context) {
    throw new Error('useDbSnapshot debe usarse dentro de DbSnapshotProvider.');
  }
  return context;
}

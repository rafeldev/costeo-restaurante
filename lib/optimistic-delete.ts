export type PaginatedItems<T> = {
  items: T[];
  total: number;
};

export type OptimisticDeleteSnapshot<T> = {
  item: T;
  index: number;
  previousId: string | null;
  nextId: string | null;
};

export function removeOptimistically<T extends { id: string }, C extends PaginatedItems<T>>(
  current: C,
  id: string,
): { next: C; snapshot: OptimisticDeleteSnapshot<T> | null } {
  const index = current.items.findIndex((item) => item.id === id);
  const item = current.items[index];
  if (!item) return { next: current, snapshot: null };

  return {
    next: {
      ...current,
      items: current.items.filter((candidate) => candidate.id !== id),
      total: Math.max(0, current.total - 1),
    } as C,
    snapshot: {
      item,
      index,
      previousId: current.items[index - 1]?.id ?? null,
      nextId: current.items[index + 1]?.id ?? null,
    },
  };
}

export function restoreOptimistically<T extends { id: string }, C extends PaginatedItems<T>>(
  current: C,
  snapshot: OptimisticDeleteSnapshot<T>,
): C {
  if (current.items.some((item) => item.id === snapshot.item.id)) return current;

  const items = [...current.items];
  const nextIndex = snapshot.nextId
    ? items.findIndex((item) => item.id === snapshot.nextId)
    : -1;
  const previousIndex = snapshot.previousId
    ? items.findIndex((item) => item.id === snapshot.previousId)
    : -1;
  const insertionIndex = nextIndex >= 0
    ? nextIndex
    : previousIndex >= 0
      ? previousIndex + 1
      : Math.min(snapshot.index, items.length);

  items.splice(insertionIndex, 0, snapshot.item);
  return { ...current, items, total: current.total + 1 } as C;
}

export function omitPendingDeletes<T extends { id: string }, C extends PaginatedItems<T>>(
  current: C,
  pendingIds: ReadonlySet<string>,
): C {
  const items = current.items.filter((item) => !pendingIds.has(item.id));
  const omitted = current.items.length - items.length;
  return omitted === 0
    ? current
    : { ...current, items, total: Math.max(0, current.total - omitted) } as C;
}

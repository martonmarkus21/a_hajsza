import { useEffect, useMemo, useState } from 'react';

export const DEFAULT_ADMIN_TABLE_PAGE_SIZE = 15;

/**
 * Kliens-oldali lapozás rendezett listához (szűrés / rendezés után).
 * A `resetKey` változásakor visszaáll az 1. oldal (pl. kereső vagy szűrő).
 */
export function useAdminListPagination<T>(
  orderedItems: T[],
  pageSize: number = DEFAULT_ADMIN_TABLE_PAGE_SIZE,
  resetKey?: string | number,
) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const totalFiltered = orderedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize) || 1);
  const currentPage = Math.min(page, totalPages);

  const slice = useMemo(
    () => orderedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [orderedItems, currentPage, pageSize],
  );

  const fromIdx = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toIdx = Math.min(currentPage * pageSize, totalFiltered);

  return {
    page: currentPage,
    setPage,
    totalPages,
    totalFiltered,
    fromIdx,
    toIdx,
    slice,
  };
}

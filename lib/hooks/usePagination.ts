import { useState, useMemo } from 'react'

export interface PaginationState {
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export function usePagination<T>(
  items: T[],
  pageSize: number = 10
) {
  const [currentPage, setCurrentPage] = useState(1)

  const paginationState = useMemo(() => {
    const totalItems = items.length
    const totalPages = Math.ceil(totalItems / pageSize)
    const validPage = Math.min(currentPage, Math.max(1, totalPages))

    if (validPage !== currentPage) {
      setCurrentPage(validPage)
    }

    return {
      currentPage: validPage,
      pageSize,
      totalItems,
      totalPages,
    }
  }, [items.length, pageSize, currentPage])

  const paginatedItems = useMemo(() => {
    const start = (paginationState.currentPage - 1) * pageSize
    const end = start + pageSize
    return items.slice(start, end)
  }, [items, pageSize, paginationState.currentPage])

  return {
    ...paginationState,
    paginatedItems,
    goToPage: setCurrentPage,
    nextPage: () => setCurrentPage(p => p + 1),
    prevPage: () => setCurrentPage(p => Math.max(1, p - 1)),
  }
}

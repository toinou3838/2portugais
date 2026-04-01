"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { AdminConjugationRow, AdminVocabularyRow, PublicLibrary } from "@/lib/types";
import { getDifficultyLabel } from "@/lib/utils";

type LibraryTab = "vocabulary" | "conjugations";
type SortDirection = "asc" | "desc";
type SortState = {
  key: string;
  direction: SortDirection;
};
type ColumnDefinition<Row> = {
  key: string;
  label: string;
  accessor: (row: Row) => string | number | boolean | null;
  render?: (row: Row) => ReactNode;
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];

function formatDirection(value: 0 | 1) {
  return value === 0 ? "fr -> pt" : "pt -> fr";
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function compareValues(
  left: string | number | boolean | null,
  right: string | number | boolean | null,
) {
  const leftMissing = left === null || left === undefined || left === "";
  const rightMissing = right === null || right === undefined || right === "";

  if (leftMissing && rightMissing) {
    return 0;
  }
  if (leftMissing) {
    return 1;
  }
  if (rightMissing) {
    return -1;
  }

  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right, "fr", { numeric: true, sensitivity: "base" });
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }

  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function buildPageItems(currentPage: number, totalPages: number): Array<number | string> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | string> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    pages.push("start-ellipsis");
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end < totalPages - 1) {
    pages.push("end-ellipsis");
  }

  pages.push(totalPages);
  return pages;
}

const vocabularyColumns: ColumnDefinition<AdminVocabularyRow>[] = [
  { key: "id", label: "ID", accessor: (row) => row.id },
  { key: "fr", label: "Français", accessor: (row) => row.fr },
  { key: "pt", label: "Portugais", accessor: (row) => row.pt },
  {
    key: "dir",
    label: "Direction",
    accessor: (row) => formatDirection(row.dir),
    render: (row) => formatDirection(row.dir),
  },
  {
    key: "difficulty",
    label: "Difficulté",
    accessor: (row) => row.difficulty,
    render: (row) => getDifficultyLabel(row.difficulty),
  },
];

const conjugationColumns: ColumnDefinition<AdminConjugationRow>[] = [
  {
    key: "id",
    label: "ID",
    accessor: (row) => {
      const numeric = Number(row.id);
      return Number.isNaN(numeric) ? row.id : numeric;
    },
  },
  { key: "fr", label: "Français", accessor: (row) => row.fr },
  { key: "pt", label: "Portugais", accessor: (row) => row.pt },
  {
    key: "dir",
    label: "Direction",
    accessor: (row) => formatDirection(row.dir),
    render: (row) => formatDirection(row.dir),
  },
  {
    key: "difficulty",
    label: "Difficulté",
    accessor: (row) => row.difficulty,
    render: (row) => getDifficultyLabel(row.difficulty),
  },
];

export function PublicLibraryPanel() {
  const [data, setData] = useState<PublicLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<LibraryTab>("vocabulary");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>({ key: "difficulty", direction: "asc" });

  useEffect(() => {
    async function loadLibrary() {
      try {
        setLoading(true);
        setError(null);
        const nextData = await apiFetch<PublicLibrary>("/library");
        setData(nextData);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Chargement de la bibliothèque impossible.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadLibrary();
  }, []);

  const columns = tab === "vocabulary" ? vocabularyColumns : conjugationColumns;
  const rows = useMemo(
    () => (tab === "vocabulary" ? data?.vocabulary ?? [] : data?.conjugations ?? []),
    [data, tab],
  );

  const filteredRows = useMemo(() => {
    const query = normalizeSearchValue(search);
    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      [row.fr, row.pt].some((value) => normalizeSearchValue(value).includes(query)),
    );
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    const nextRows = [...filteredRows];
    if (!sort) {
      return nextRows;
    }

    const column = columns.find((item) => item.key === sort.key);
    if (!column) {
      return nextRows;
    }

    nextRows.sort((left, right) => {
      const comparison = compareValues(
        column.accessor(left as never),
        column.accessor(right as never),
      );
      return sort.direction === "asc" ? comparison : -comparison;
    });
    return nextRows;
  }, [columns, filteredRows, sort]);

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = sortedRows.slice(startIndex, startIndex + pageSize);
  const pageItems = buildPageItems(currentPage, totalPages);

  useEffect(() => {
    setPage(1);
    setSearch("");
    setSort({ key: "difficulty", direction: "asc" });
  }, [tab]);

  function toggleSort(columnKey: string) {
    setSort((current) => {
      if (!current || current.key !== columnKey) {
        return { key: columnKey, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key: columnKey, direction: "desc" };
      }
      return null;
    });
    setPage(1);
  }

  function renderSortIcon(columnKey: string) {
    if (!sort || sort.key !== columnKey) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-35" />;
    }
    if (sort.direction === "asc") {
      return <ArrowUp className="h-3.5 w-3.5" />;
    }
    return <ArrowDown className="h-3.5 w-3.5" />;
  }

  return (
    <section className="glass-panel shell-border rounded-[2rem] p-6 shadow-soft">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm uppercase tracking-[0.22em] text-[rgba(22,50,41,0.48)]">
            Bibliothèque ouverte
          </p>
          <h2 className="section-title mt-2 text-3xl font-semibold">
            Parcours la base avant de te lancer.
          </h2>
          {expanded ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[rgba(22,50,41,0.66)]">
              Lis rapidement les paires en diagonale, trie-les par difficulté ou par
              direction, puis lance un quiz pour consolider ce que tu viens de voir.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 xl:justify-end xl:self-start">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(22,50,41,0.08)] bg-white/85 px-4 py-2 text-sm font-medium text-[rgba(22,50,41,0.66)]">
            <BookOpen className="h-4 w-4 text-[#163229]" />
            Accès libre au vocabulaire et à la conjugaison
          </div>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(22,50,41,0.12)] bg-white/88 px-4 py-2 text-sm font-semibold text-[#163229] transition hover:bg-white"
          >
            {expanded ? "Réduire" : "Étendre"}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded ? (
        <>
      <div className="mt-6 flex flex-wrap gap-3">
        {([
          ["vocabulary", "Vocabulaire"],
          ["conjugations", "Conjugaison"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`inline-flex h-11 w-[10.5rem] min-w-[10.5rem] max-w-[10.5rem] items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition ${
              tab === value
                ? "bg-[#163229] text-white"
                : "border border-[rgba(22,50,41,0.12)] bg-white/82 text-[#163229] hover:bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 glass-panel shell-border overflow-hidden rounded-[1.8rem] shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(22,50,41,0.08)] px-4 py-3">
          <p className="text-sm font-medium text-[rgba(22,50,41,0.62)]">
            {totalRows} entrées, page {currentPage} / {totalPages}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[rgba(22,50,41,0.62)]">
              <span>Recherche</span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Français ou portugais"
                className="w-56 rounded-full border border-[rgba(22,50,41,0.12)] bg-white/88 px-4 py-2 text-sm text-[#163229] outline-none placeholder:text-[rgba(22,50,41,0.38)]"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-[rgba(22,50,41,0.62)]">
              <span>Par page</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-full border border-[rgba(22,50,41,0.12)] bg-white/88 px-3 py-2 text-sm font-semibold text-[#163229] outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(22,50,41,0.12)] bg-white/88 text-[#163229] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageItems.map((item, index) =>
                typeof item === "number" ? (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-semibold transition ${
                      item === currentPage
                        ? "bg-[#163229] text-white"
                        : "border border-[rgba(22,50,41,0.12)] bg-white/88 text-[#163229] hover:bg-white"
                    }`}
                  >
                    {item}
                  </button>
                ) : (
                  <span
                    key={`${item}-${index}`}
                    className="px-2 text-sm text-[rgba(22,50,41,0.4)]"
                  >
                    …
                  </span>
                ),
              )}
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(22,50,41,0.12)] bg-white/88 text-[#163229] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="h-full max-h-[30rem] overflow-auto overscroll-contain">
          {loading ? (
            <div className="px-4 py-6 text-sm text-[rgba(22,50,41,0.56)]">
              Chargement de la bibliothèque…
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-sm font-medium text-[#a24d33]">{error}</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-[2] bg-[#f1ebdf] text-left text-[rgba(22,50,41,0.66)] shadow-[0_1px_0_rgba(22,50,41,0.08)]">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className="bg-[#f1ebdf] px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex items-center gap-1 font-semibold transition hover:text-[#163229]"
                      >
                        <span>{column.label}</span>
                        {renderSortIcon(column.key)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, index) => (
                  <tr
                    key={`library-${tab}-${startIndex + index}`}
                    className="border-t border-[rgba(22,50,41,0.08)]"
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3">
                        {column.render
                          ? column.render(row as never)
                          : String(column.accessor(row as never) ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !error && paginatedRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-[rgba(22,50,41,0.56)]">
              Aucune donnée trouvée pour cette recherche.
            </div>
          ) : null}
        </div>
      </div>
        </>
      ) : (
        <div className="mt-4 text-sm text-[rgba(22,50,41,0.58)]">
          Ouvre ce module avec le chevron pour parcourir la base avant de lancer un quiz.
        </div>
      )}
    </section>
  );
}

"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Pencil,
  RefreshCcw,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import type {
  AdminConjugationRow,
  AdminBulkImportResult,
  AdminDashboard,
  AdminPeriodStats,
  AdminReminderRow,
  AdminUserRow,
  AdminVocabularyRow,
} from "@/lib/types";

type AdminPanelProps = {
  open: boolean;
  onClose: () => void;
};

type AdminTab = "reminders" | "users" | "vocabulary" | "conjugations" | "import";
type SortDirection = "asc" | "desc";
type SortState = {
  key: string;
  direction: SortDirection;
};
type ProfilePeriod = "day" | "week" | "month";
type EditDraft = {
  fr: string;
  pt: string;
};

type ColumnDefinition<Row> = {
  key: string;
  label: string;
  accessor: (row: Row) => string | number | boolean | null;
  render?: (row: Row) => ReactNode;
};

type PaginationState = Record<AdminTab, number>;
type PageSizeState = Record<AdminTab, number>;
type SortStateMap = Record<AdminTab, SortState | null>;
type SearchState = Record<AdminTab, string>;

const tabLabels: Record<AdminTab, string> = {
  reminders: "Reminders",
  users: "Profils",
  vocabulary: "Vocabulaire",
  conjugations: "Conjugaison",
  import: "Import",
};

const INITIAL_PAGES: PaginationState = {
  reminders: 1,
  users: 1,
  vocabulary: 1,
  conjugations: 1,
  import: 1,
};

const INITIAL_PAGE_SIZES: PageSizeState = {
  reminders: 20,
  users: 20,
  vocabulary: 20,
  conjugations: 20,
  import: 20,
};

const INITIAL_SORTS: SortStateMap = {
  reminders: { key: "remaining_questions", direction: "asc" },
  users: null,
  vocabulary: { key: "created_at", direction: "desc" },
  conjugations: null,
  import: null,
};

const INITIAL_SEARCHES: SearchState = {
  reminders: "",
  users: "",
  vocabulary: "",
  conjugations: "",
  import: "",
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];

function shuffleDigits(): string[] {
  const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  for (let index = digits.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [digits[index], digits[randomIndex]] = [digits[randomIndex], digits[index]];
  }
  return digits;
}

function formatDirection(value: 0 | 1) {
  return value === 0 ? "fr -> pt" : "pt -> fr";
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
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

const reminderColumns: ColumnDefinition<AdminReminderRow>[] = [
  { key: "email", label: "Email", accessor: (row) => row.email },
  {
    key: "display_name",
    label: "Nom",
    accessor: (row) => row.display_name ?? "",
    render: (row) => row.display_name ?? "—",
  },
  { key: "current_streak", label: "Streak", accessor: (row) => row.current_streak },
  { key: "answered_questions", label: "Répondues", accessor: (row) => row.answered_questions },
  { key: "remaining_questions", label: "Restantes", accessor: (row) => row.remaining_questions },
  { key: "day", label: "Jour", accessor: (row) => row.day },
];

function getPeriodStats(row: AdminUserRow, period: ProfilePeriod): AdminPeriodStats {
  switch (period) {
    case "week":
      return row.week_stats;
    case "month":
      return row.month_stats;
    default:
      return row.day_stats;
  }
}

function getUserColumns(period: ProfilePeriod): ColumnDefinition<AdminUserRow>[] {
  return [
    { key: "email", label: "Email", accessor: (row) => row.email },
    {
      key: "display_name",
      label: "Nom",
      accessor: (row) => row.display_name ?? "",
      render: (row) => row.display_name ?? "—",
    },
    {
      key: "reminder_opt_in",
      label: "Rappels",
      accessor: (row) => row.reminder_opt_in,
      render: (row) => (row.reminder_opt_in ? "Oui" : "Non"),
    },
    { key: "current_streak", label: "Streak", accessor: (row) => row.current_streak },
    {
      key: "answered_questions",
      label: "Répondues",
      accessor: (row) => getPeriodStats(row, period).answered_questions,
      render: (row) => getPeriodStats(row, period).answered_questions,
    },
    {
      key: "correct_answers",
      label: "Correctes",
      accessor: (row) => getPeriodStats(row, period).correct_answers,
      render: (row) => getPeriodStats(row, period).correct_answers,
    },
    {
      key: "quizzes_completed",
      label: "Quiz",
      accessor: (row) => getPeriodStats(row, period).quizzes_completed,
      render: (row) => getPeriodStats(row, period).quizzes_completed,
    },
    {
      key: "goal_reached_count",
      label: period === "day" ? "Objectif" : "Jours validés",
      accessor: (row) => getPeriodStats(row, period).goal_reached_count,
      render: (row) =>
        period === "day"
          ? getPeriodStats(row, period).goal_reached_count > 0
            ? "Atteint"
            : "En cours"
          : `${getPeriodStats(row, period).goal_reached_count}`,
    },
    {
      key: "reminders_sent_count",
      label: period === "day" ? "Reminder envoyé" : "Reminders",
      accessor: (row) =>
        period === "day"
          ? parseDate(row.today_reminder_sent_at)
          : getPeriodStats(row, period).reminders_sent_count,
      render: (row) =>
        period === "day"
          ? formatDate(row.today_reminder_sent_at)
          : `${getPeriodStats(row, period).reminders_sent_count}`,
    },
  ];
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
  { key: "difficulty", label: "Difficulté", accessor: (row) => row.difficulty },
  {
    key: "created_by_display_name",
    label: "Créé par",
    accessor: (row) => row.created_by_display_name ?? "",
    render: (row) => row.created_by_display_name ?? "—",
  },
  {
    key: "created_at",
    label: "Créé le",
    accessor: (row) => parseDate(row.created_at),
    render: (row) => formatDate(row.created_at),
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
  { key: "difficulty", label: "Difficulté", accessor: (row) => row.difficulty },
];

export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("reminders");
  const [shuffledDigits, setShuffledDigits] = useState<string[]>(() => shuffleDigits());
  const [pageByTab, setPageByTab] = useState<PaginationState>(INITIAL_PAGES);
  const [pageSizeByTab, setPageSizeByTab] = useState<PageSizeState>(INITIAL_PAGE_SIZES);
  const [sortByTab, setSortByTab] = useState<SortStateMap>(INITIAL_SORTS);
  const [searchByTab, setSearchByTab] = useState<SearchState>(INITIAL_SEARCHES);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [deletingDeleteKey, setDeletingDeleteKey] = useState<string | null>(null);
  const [pendingEditKey, setPendingEditKey] = useState<string | null>(null);
  const [savingEditKey, setSavingEditKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<AdminBulkImportResult | null>(null);
  const [profilePeriod, setProfilePeriod] = useState<ProfilePeriod>("day");

  const unlocked = dashboard !== null && activeCode !== null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      return;
    }
    setCode("");
    setActiveCode(null);
    setDashboard(null);
    setError(null);
    setTab("reminders");
    setShuffledDigits(shuffleDigits());
    setPageByTab(INITIAL_PAGES);
    setPageSizeByTab(INITIAL_PAGE_SIZES);
    setSortByTab(INITIAL_SORTS);
    setSearchByTab(INITIAL_SEARCHES);
    setPendingDeleteKey(null);
    setDeletingDeleteKey(null);
    setPendingEditKey(null);
    setSavingEditKey(null);
    setEditDraft(null);
    setImportText("");
    setImportResult(null);
    setProfilePeriod("day");
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [open]);

  useEffect(() => {
    if (!open || unlocked) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) {
        setError(null);
        setCode((current) => (current.length < 8 ? `${current}${event.key}` : current));
        return;
      }
      if (event.key === "Backspace") {
        setError(null);
        setCode((current) => current.slice(0, -1));
        return;
      }
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, unlocked]);

  useEffect(() => {
    if (!open || unlocked || loading || code.length !== 8) {
      return;
    }
    void loadDashboard(code);
  }, [code, loading, open, unlocked]);

  useEffect(() => {
    setPendingDeleteKey(null);
    setDeletingDeleteKey(null);
    setPendingEditKey(null);
    setSavingEditKey(null);
    setEditDraft(null);
  }, [tab, pageByTab, searchByTab]);

  const stats = useMemo(() => {
    if (!dashboard) {
      return null;
    }

    const reminderOptIn = dashboard.users.filter((user) => user.reminder_opt_in).length;
    const reachedGoal = dashboard.users.filter((user) => user.today_goal_reached).length;
    const averageStreak =
      dashboard.users.length > 0
        ? Math.round(
            (dashboard.users.reduce((sum, user) => sum + user.current_streak, 0) /
              dashboard.users.length) *
              10,
          ) / 10
        : 0;
    const longestStreak = dashboard.users.reduce(
      (current, user) => Math.max(current, user.current_streak),
      0,
    );

    return [
      { label: "En attente reminder", value: dashboard.pending_reminders.length },
      { label: "Utilisateurs chargés", value: dashboard.users.length },
      { label: "Rappels activés", value: reminderOptIn },
      { label: "Objectifs atteints", value: reachedGoal },
      { label: "Streak moyen", value: averageStreak },
      { label: "Plus haut streak", value: longestStreak },
    ];
  }, [dashboard]);

  async function loadDashboard(nextCode: string, options?: { preserveView?: boolean }) {
    setLoading(true);
    setError(null);
    try {
      await apiFetch<{ ok: boolean }>("/admin/verify", { adminCode: nextCode });
      const data = await apiFetch<AdminDashboard>("/admin/dashboard", {
        adminCode: nextCode,
      });
      setDashboard(data);
      setActiveCode(nextCode);
      setCode("");
      setPendingDeleteKey(null);
      setDeletingDeleteKey(null);
      setPendingEditKey(null);
      setSavingEditKey(null);
      setEditDraft(null);
      if (!options?.preserveView) {
        setTab("reminders");
        setPageByTab(INITIAL_PAGES);
        setSortByTab(INITIAL_SORTS);
        setSearchByTab(INITIAL_SEARCHES);
        setProfilePeriod("day");
      }
    } catch (requestError) {
      setDashboard(null);
      setActiveCode(null);
      setCode("");
      setShuffledDigits(shuffleDigits());
      setError(
        requestError instanceof Error ? requestError.message : "Accès admin impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  function appendDigit(digit: string) {
    if (loading) {
      return;
    }
    setError(null);
    setCode((current) => (current.length < 8 ? `${current}${digit}` : current));
  }

  function removeDigit() {
    if (loading) {
      return;
    }
    setError(null);
    setCode((current) => current.slice(0, -1));
  }

  function clearCode() {
    if (loading) {
      return;
    }
    setError(null);
    setCode("");
    setShuffledDigits(shuffleDigits());
  }

  function lockPanel() {
    setDashboard(null);
    setActiveCode(null);
    setCode("");
    setError(null);
    setTab("reminders");
    setShuffledDigits(shuffleDigits());
    setPageByTab(INITIAL_PAGES);
    setSortByTab(INITIAL_SORTS);
    setSearchByTab(INITIAL_SEARCHES);
    setPendingDeleteKey(null);
    setDeletingDeleteKey(null);
    setPendingEditKey(null);
    setSavingEditKey(null);
    setEditDraft(null);
    setProfilePeriod("day");
  }

  function closePanel() {
    lockPanel();
    onClose();
  }

  async function refreshDashboard() {
    if (!activeCode) {
      return;
    }
    await loadDashboard(activeCode, { preserveView: true });
  }

  async function deletePendingRow() {
    if (!activeCode || !pendingDeleteKey) {
      return;
    }

    setDeletingDeleteKey(pendingDeleteKey);
    setError(null);
    try {
      if (pendingDeleteKey.startsWith("vocabulary:")) {
        const entryId = pendingDeleteKey.replace("vocabulary:", "");
        await apiFetch<{ ok: boolean }>(`/admin/vocabulary/${entryId}`, {
          method: "DELETE",
          adminCode: activeCode,
        });
      } else if (pendingDeleteKey.startsWith("conjugations:")) {
        const entryId = pendingDeleteKey.replace("conjugations:", "");
        await apiFetch<{ ok: boolean }>(`/admin/conjugations/${encodeURIComponent(entryId)}`, {
          method: "DELETE",
          adminCode: activeCode,
        });
      }
      await refreshDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Suppression impossible.",
      );
    } finally {
      setDeletingDeleteKey(null);
    }
  }

  function startEditingRow(
    row: AdminVocabularyRow | AdminConjugationRow,
    rowKey: string,
  ) {
    setPendingDeleteKey(null);
    setError(null);
    setPendingEditKey(rowKey);
    setEditDraft({
      fr: row.fr,
      pt: row.pt,
    });
  }

  function cancelEditingRow() {
    setPendingEditKey(null);
    setSavingEditKey(null);
    setEditDraft(null);
  }

  async function saveEditedRow() {
    if (!activeCode || !pendingEditKey || !editDraft) {
      return;
    }

    const normalizedFr = editDraft.fr.trim();
    const normalizedPt = editDraft.pt.trim();
    if (!normalizedFr || !normalizedPt) {
      setError("Les champs Français et Portugais sont obligatoires.");
      return;
    }

    setSavingEditKey(pendingEditKey);
    setError(null);
    try {
      if (pendingEditKey.startsWith("vocabulary:")) {
        const entryId = pendingEditKey.replace("vocabulary:", "");
        await apiFetch<{ ok: boolean }>(`/admin/vocabulary/${entryId}`, {
          method: "PATCH",
          adminCode: activeCode,
          body: JSON.stringify({
            fr: normalizedFr,
            pt: normalizedPt,
          }),
        });
      } else if (pendingEditKey.startsWith("conjugations:")) {
        const entryId = pendingEditKey.replace("conjugations:", "");
        const originalRow = currentRows.find((row) => getRowActionKey(row) === pendingEditKey) as
          | AdminConjugationRow
          | undefined;
        if (!originalRow) {
          throw new Error("Entrée de conjugaison introuvable.");
        }
        await apiFetch<{ ok: boolean }>(
          `/admin/conjugations/${encodeURIComponent(entryId)}`,
          {
            method: "PATCH",
            adminCode: activeCode,
            body: JSON.stringify({
              fr: normalizedFr,
              pt: normalizedPt,
              dir: originalRow.dir,
              difficulty: originalRow.difficulty,
            }),
          },
        );
      }

      await refreshDashboard();
      cancelEditingRow();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Modification impossible.");
    } finally {
      setSavingEditKey(null);
    }
  }

  async function handleImport() {
    if (!activeCode || !importText.trim()) {
      setError("Colle d’abord un bloc CSV à importer.");
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const result = await apiFetch<AdminBulkImportResult>("/admin/import", {
        method: "POST",
        adminCode: activeCode,
        body: JSON.stringify({
          raw_text: importText,
        }),
      });
      setImportResult(result);
      await refreshDashboard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Import impossible.");
    } finally {
      setImporting(false);
    }
  }

  function toggleSort(columnKey: string) {
    setSortByTab((current) => {
      const previous = current[tab];
      let next: SortState | null;
      if (!previous || previous.key !== columnKey) {
        next = { key: columnKey, direction: "asc" };
      } else if (previous.direction === "asc") {
        next = { key: columnKey, direction: "desc" };
      } else {
        next = null;
      }
      return { ...current, [tab]: next };
    });
    setPageByTab((current) => ({ ...current, [tab]: 1 }));
  }

  function setPage(page: number) {
    setPageByTab((current) => ({ ...current, [tab]: Math.max(1, page) }));
  }

  function setPageSize(nextValue: number) {
    setPageSizeByTab((current) => ({ ...current, [tab]: nextValue }));
    setPageByTab((current) => ({ ...current, [tab]: 1 }));
  }

  const currentColumns = useMemo(() => {
    switch (tab) {
      case "reminders":
        return reminderColumns as ColumnDefinition<
          AdminReminderRow | AdminUserRow | AdminVocabularyRow | AdminConjugationRow
        >[];
      case "users":
        return getUserColumns(profilePeriod) as ColumnDefinition<
          AdminReminderRow | AdminUserRow | AdminVocabularyRow | AdminConjugationRow
        >[];
      case "vocabulary":
        return vocabularyColumns as ColumnDefinition<
          AdminReminderRow | AdminUserRow | AdminVocabularyRow | AdminConjugationRow
        >[];
      case "conjugations":
        return conjugationColumns as ColumnDefinition<
          AdminReminderRow | AdminUserRow | AdminVocabularyRow | AdminConjugationRow
        >[];
      default:
        return [];
    }
  }, [profilePeriod, tab]);

  const currentRows = useMemo(() => {
    if (!dashboard) {
      return [] as Array<
        AdminReminderRow | AdminUserRow | AdminVocabularyRow | AdminConjugationRow
      >;
    }

    switch (tab) {
      case "reminders":
        return dashboard.pending_reminders;
      case "users":
        return dashboard.users;
      case "vocabulary":
        return dashboard.vocabulary;
      case "conjugations":
        return dashboard.conjugations;
      default:
        return [];
    }
  }, [dashboard, tab]);

  const filteredRows = useMemo(() => {
    const query = normalizeSearchValue(searchByTab[tab]);
    if (!query || (tab !== "vocabulary" && tab !== "conjugations")) {
      return currentRows;
    }

    return currentRows.filter((row) => {
      const candidate = row as AdminVocabularyRow | AdminConjugationRow;
      return [candidate.fr, candidate.pt].some((value) =>
        normalizeSearchValue(value).includes(query),
      );
    });
  }, [currentRows, searchByTab, tab]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    const sort = sortByTab[tab];
    if (!sort) {
      return rows;
    }

    const column = currentColumns.find((item) => item.key === sort.key);
    if (!column) {
      return rows;
    }

    rows.sort((left, right) => {
      const comparison = compareValues(column.accessor(left), column.accessor(right));
      return sort.direction === "asc" ? comparison : -comparison;
    });
    return rows;
  }, [currentColumns, filteredRows, sortByTab, tab]);

  const totalRows = sortedRows.length;
  const currentPageSize = pageSizeByTab[tab];
  const totalPages = Math.max(1, Math.ceil(totalRows / currentPageSize));
  const currentPage = Math.min(pageByTab[tab], totalPages);
  const startIndex = (currentPage - 1) * currentPageSize;
  const endIndex = startIndex + currentPageSize;
  const paginatedRows = sortedRows.slice(startIndex, endIndex);
  const pageItems = buildPageItems(currentPage, totalPages);
  const showRowActions = tab === "vocabulary" || tab === "conjugations";

  useEffect(() => {
    if (tab === "import") {
      return;
    }
    tableScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [currentPage, currentPageSize, searchByTab, sortByTab, tab, profilePeriod]);

  function getRowActionKey(
    row: AdminReminderRow | AdminUserRow | AdminVocabularyRow | AdminConjugationRow,
  ) {
    if (tab === "vocabulary") {
      return `vocabulary:${String((row as AdminVocabularyRow).id)}`;
    }
    if (tab === "conjugations") {
      return `conjugations:${String((row as AdminConjugationRow).id)}`;
    }
    return null;
  }

  function renderSortIcon(columnKey: string) {
    const sort = sortByTab[tab];
    if (!sort || sort.key !== columnKey) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-35" />;
    }
    if (sort.direction === "asc") {
      return <ArrowUp className="h-3.5 w-3.5" />;
    }
    return <ArrowDown className="h-3.5 w-3.5" />;
  }

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[rgba(12,24,20,0.38)] backdrop-blur-sm">
      <div className="absolute inset-0 p-0 sm:p-3">
        <div className="glass-panel-strong shell-border relative flex h-full w-full flex-col overflow-hidden rounded-none shadow-card sm:mx-auto sm:max-w-[92rem] sm:rounded-[2.2rem]">
          <div className="flex items-center justify-between border-b border-[rgba(22,50,41,0.08)] px-6 py-5">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[rgba(22,50,41,0.42)]">
                Panneau admin
              </p>
              <h2 className="section-title mt-2 text-3xl font-semibold">
                {unlocked
                  ? "Vue directe des données et des reminders."
                  : "Accès sécurisé de niveau administrateur."}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {unlocked ? (
                <>
                  <button
                    type="button"
                    onClick={() => void refreshDashboard()}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-full border border-[rgba(22,50,41,0.12)] bg-white/82 px-4 py-2.5 text-sm font-semibold text-[#163229] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Actualiser
                  </button>
                  <button
                    type="button"
                    onClick={lockPanel}
                    className="flex items-center gap-2 rounded-full bg-[#163229] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#21453a]"
                  >
                    <Lock className="h-4 w-4" />
                    Verrouiller
                  </button>
                </>
              ) : null}

              <button
                type="button"
                onClick={closePanel}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(22,50,41,0.12)] bg-white/80 text-[#163229] transition hover:bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden px-4 pb-4 sm:px-6 sm:pb-6">
            {unlocked && dashboard ? (
              <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden pt-6">
                {stats ? (
                  <div className="overflow-x-auto pb-1">
                    <div className="grid min-w-[56rem] grid-cols-6 gap-2">
                      {stats.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[0.9rem] border border-[rgba(22,50,41,0.08)] bg-white/80 px-3 py-2 shadow-soft"
                        >
                          <p className="text-[9px] uppercase tracking-[0.16em] text-[rgba(22,50,41,0.42)]">
                            {item.label}
                          </p>
                          <p className="mt-1 text-[1.5rem] font-semibold leading-none text-[#163229]">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {(Object.keys(tabLabels) as AdminTab[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTab(item)}
                      className={`inline-flex h-11 w-[10.5rem] min-w-[10.5rem] max-w-[10.5rem] shrink-0 basis-[10.5rem] items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition ${
                        tab === item
                          ? "bg-[#163229] text-white"
                          : "border border-[rgba(22,50,41,0.12)] bg-white/82 text-[#163229] hover:bg-white"
                      }`}
                    >
                      {tabLabels[item]}
                    </button>
                  ))}
                </div>

                <div className="glass-panel shell-border min-h-0 flex-1 overflow-hidden rounded-[1.8rem] shadow-soft">
                  {tab === "import" ? (
                    <div className="grid h-full min-h-0 gap-5 overflow-hidden p-5 xl:grid-cols-[1.1fr_0.9fr]">
                      <div className="min-h-0 rounded-[1.5rem] border border-[rgba(22,50,41,0.08)] bg-white/86 p-4 shadow-soft">
                        <p className="text-sm uppercase tracking-[0.22em] text-[rgba(22,50,41,0.42)]">
                          Collage CSV
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold text-[#163229]">
                          Importe plusieurs paires d’un coup.
                        </h3>
                        <textarea
                          value={importText}
                          onChange={(event) => setImportText(event.target.value)}
                          placeholder={
                            "prendre;pegar;vocabulaire;1\nje mangerai;eu comerei;conjugaison;2"
                          }
                          className="mt-4 h-[11rem] w-full rounded-[1.35rem] border border-[rgba(22,50,41,0.12)] bg-[#fffdf8] px-4 py-4 text-sm leading-6 text-[#163229] outline-none placeholder:text-[rgba(22,50,41,0.34)]"
                        />
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => void handleImport()}
                            disabled={importing}
                            className="rounded-full bg-[#163229] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#21453a] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {importing ? "Import en cours..." : "Importer dans la base"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImportText("");
                              setImportResult(null);
                            }}
                            disabled={importing}
                            className="rounded-full border border-[rgba(22,50,41,0.12)] bg-white px-5 py-3 text-sm font-semibold text-[#163229] transition hover:bg-[#f8f3eb] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Réinitialiser
                          </button>
                        </div>
                      </div>

                      <div className="min-h-0 rounded-[1.5rem] border border-[rgba(22,50,41,0.08)] bg-white/86 p-4 shadow-soft">
                          <p className="text-sm uppercase tracking-[0.22em] text-[rgba(22,50,41,0.42)]">
                            Résultat d’import
                          </p>
                          {importResult ? (
                            <div className="mt-3 flex h-full min-h-[10rem] flex-col gap-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-[1.1rem] bg-[rgba(22,50,41,0.06)] px-4 py-3">
                                  <p className="text-xs uppercase tracking-[0.18em] text-[rgba(22,50,41,0.42)]">
                                    Importées
                                  </p>
                                  <p className="mt-1 text-2xl font-semibold text-[#163229]">
                                    {importResult.imported}
                                  </p>
                                </div>
                                <div className="rounded-[1.1rem] bg-[rgba(185,119,63,0.1)] px-4 py-3">
                                  <p className="text-xs uppercase tracking-[0.18em] text-[rgba(22,50,41,0.42)]">
                                    Ignorées
                                  </p>
                                  <p className="mt-1 text-2xl font-semibold text-[#9e6230]">
                                    {importResult.skipped}
                                  </p>
                                </div>
                              </div>
                              <div className="min-h-0 max-h-[10rem] overflow-auto rounded-[1.1rem] border border-[rgba(22,50,41,0.08)] bg-[#fffdf8] p-3 text-sm text-[rgba(22,50,41,0.66)]">
                                {importResult.details.length > 0 ? (
                                  <ul className="space-y-2">
                                    {importResult.details.map((detail, index) => (
                                      <li key={`${detail}-${index}`}>{detail}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p>Aucun avertissement sur ce dernier import.</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 rounded-[1.1rem] border border-[rgba(22,50,41,0.08)] bg-[#fffdf8] px-4 py-5 text-sm text-[rgba(22,50,41,0.58)]">
                              Le header est optionnel. Tu peux coller directement des lignes au format{" "}
                              <span className="font-semibold">fr;pt;emplacement;difficulté</span>.
                            </div>
                          )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(22,50,41,0.08)] px-4 py-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-[rgba(22,50,41,0.62)]">
                            {totalRows} entrées, page {currentPage} / {totalPages}
                          </p>
                          {tab === "users" ? (
                            <p className="text-xs text-[rgba(22,50,41,0.48)]">
                              {profilePeriod === "day"
                                ? "Statistiques du jour en cours."
                                : profilePeriod === "week"
                                  ? "Cumul glissant sur les 7 derniers jours."
                                  : "Cumul glissant sur les 30 derniers jours."}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {tab === "users" ? (
                            <div className="flex items-center gap-2 rounded-full border border-[rgba(22,50,41,0.1)] bg-white/80 p-1">
                              {([
                                ["day", "Jour"],
                                ["week", "Semaine"],
                                ["month", "Mois"],
                              ] as const).map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => {
                                    setProfilePeriod(value);
                                    setPage(1);
                                  }}
                                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                    profilePeriod === value
                                      ? "bg-[#163229] text-white"
                                      : "text-[#163229] hover:bg-[#f5efe4]"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {tab === "vocabulary" || tab === "conjugations" ? (
                            <label className="flex items-center gap-2 text-sm text-[rgba(22,50,41,0.62)]">
                              <span>Recherche</span>
                              <input
                                value={searchByTab[tab]}
                                onChange={(event) => {
                                  setSearchByTab((current) => ({
                                    ...current,
                                    [tab]: event.target.value,
                                  }));
                                  setPageByTab((current) => ({ ...current, [tab]: 1 }));
                                }}
                                placeholder="Français ou portugais"
                                className="w-56 rounded-full border border-[rgba(22,50,41,0.12)] bg-white/88 px-4 py-2 text-sm text-[#163229] outline-none placeholder:text-[rgba(22,50,41,0.38)]"
                              />
                            </label>
                          ) : null}

                          <label className="flex items-center gap-2 text-sm text-[rgba(22,50,41,0.62)]">
                            <span>Par page</span>
                            <select
                              value={currentPageSize}
                              onChange={(event) => setPageSize(Number(event.target.value))}
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

                      <div
                        ref={tableScrollRef}
                        className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable]"
                      >
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 z-[2] bg-[#f1ebdf] text-left text-[rgba(22,50,41,0.66)] shadow-[0_1px_0_rgba(22,50,41,0.08)]">
                            <tr>
                              {currentColumns.map((column) => (
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
                              {showRowActions ? (
                                <th className="bg-[#f1ebdf] px-4 py-3 text-right font-semibold">
                                  Actions
                                </th>
                              ) : null}
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedRows.map((row, index) => {
                                  const rowActionKey = getRowActionKey(row);
                                  const isEditing = rowActionKey !== null && pendingEditKey === rowActionKey;
                                  const isDeleting = rowActionKey !== null && pendingDeleteKey === rowActionKey;
                                  const busy = rowActionKey !== null && (savingEditKey === rowActionKey || deletingDeleteKey === rowActionKey);

                              return (
                                <tr
                                  key={`row-${tab}-${startIndex + index}`}
                                  className="border-t border-[rgba(22,50,41,0.08)]"
                                >
                                  {currentColumns.map((column) => {
                                    const editableField =
                                      isEditing && editDraft && (column.key === "fr" || column.key === "pt")
                                        ? (column.key as keyof EditDraft)
                                        : null;
                                    return (
                                      <td key={column.key} className="px-4 py-3">
                                        {editableField ? (
                                          <input
                                            value={editDraft?.[editableField] ?? ""}
                                            onChange={(event) =>
                                              setEditDraft((current) =>
                                                current
                                                  ? {
                                                      ...current,
                                                      [editableField]: event.target.value,
                                                    }
                                                  : current,
                                              )
                                            }
                                            className="w-full rounded-full border border-[rgba(22,50,41,0.12)] bg-white px-4 py-2 text-sm text-[#163229] outline-none"
                                          />
                                        ) : column.render ? (
                                          column.render(row as never)
                                        ) : (
                                          String(column.accessor(row as never) ?? "—")
                                        )}
                                      </td>
                                    );
                                  })}
                                  {showRowActions ? (
                                    <td className="px-4 py-3">
                                      {rowActionKey ? (
                                        isDeleting ? (
                                          <div className="flex justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => void deletePendingRow()}
                                              disabled={busy}
                                              className="rounded-full bg-[#163229] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#21453a] disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              Oui
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setPendingDeleteKey(null)}
                                              disabled={busy}
                                              className="rounded-full border border-[rgba(22,50,41,0.12)] bg-white px-3 py-1.5 text-xs font-semibold text-[#163229] transition hover:bg-[#f8f3eb] disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              Non
                                            </button>
                                          </div>
                                        ) : isEditing ? (
                                          <div className="flex justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => void saveEditedRow()}
                                              disabled={busy}
                                              className="rounded-full bg-[#163229] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#21453a] disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              Oui
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelEditingRow}
                                              disabled={busy}
                                              className="rounded-full border border-[rgba(22,50,41,0.12)] bg-white px-3 py-1.5 text-xs font-semibold text-[#163229] transition hover:bg-[#f8f3eb] disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              Non
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                startEditingRow(
                                                  row as AdminVocabularyRow | AdminConjugationRow,
                                                  rowActionKey,
                                                )
                                              }
                                              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(22,50,41,0.12)] bg-white text-[#163229] transition hover:bg-[#f8f3eb]"
                                            >
                                              <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPendingEditKey(null);
                                                setEditDraft(null);
                                                setPendingDeleteKey(rowActionKey);
                                              }}
                                              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(220,38,38,0.16)] bg-[rgba(220,38,38,0.06)] text-[#b42318] transition hover:bg-[rgba(220,38,38,0.12)]"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          </div>
                                        )
                                      ) : null}
                                    </td>
                                  ) : null}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {paginatedRows.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-[rgba(22,50,41,0.56)]">
                            Aucune donnée sur cette page.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative h-full min-h-0 overflow-hidden pt-0">
                <div className="pointer-events-none select-none blur-[14px] opacity-80">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-24 rounded-[1.35rem] border border-[rgba(22,50,41,0.08)] bg-white/80 px-4 py-4 shadow-soft"
                      />
                    ))}
                  </div>
                  <div className="mt-5 flex gap-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-12 w-[11rem] rounded-full bg-[rgba(22,50,41,0.08)]"
                      />
                    ))}
                  </div>
                  <div className="mt-5 rounded-[1.8rem] border border-[rgba(22,50,41,0.08)] bg-white/70 p-4 shadow-soft">
                    <div className="grid gap-3">
                      {Array.from({ length: 9 }).map((_, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="grid grid-cols-5 gap-3 rounded-[1rem] border border-[rgba(22,50,41,0.08)] bg-white/66 px-4 py-4"
                        >
                          {Array.from({ length: 5 }).map((__, cellIndex) => (
                            <div
                              key={cellIndex}
                              className="h-4 rounded-full bg-[rgba(22,50,41,0.09)]"
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="absolute inset-0 overflow-y-auto overscroll-contain touch-pan-y [scrollbar-gutter:stable]">
                  <div className="flex min-h-full items-start justify-center px-1 py-1 sm:px-4 sm:py-4">
                    <div className="glass-panel-strong shell-border my-auto w-full max-w-xl rounded-[2rem] p-4 shadow-card sm:rounded-[2.1rem] sm:p-5">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(22,50,41,0.08)] text-[#163229]">
                        <Shield className="h-8 w-8" />
                      </div>

                      <p className="mt-4 text-center text-xs uppercase tracking-[0.24em] text-[rgba(22,50,41,0.44)]">
                        Accès chiffré
                      </p>

                      <div className="mt-4 flex justify-center gap-2 sm:gap-3">
                        {Array.from({ length: 8 }).map((_, index) => (
                          <span
                            key={index}
                            className={`h-3.5 w-3.5 rounded-full border sm:h-4 sm:w-4 ${
                              index < code.length
                                ? "border-[#163229] bg-[#163229]"
                                : "border-[rgba(22,50,41,0.18)] bg-transparent"
                            }`}
                          />
                        ))}
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
                        {shuffledDigits.slice(0, 9).map((digit) => (
                          <button
                            key={digit}
                            type="button"
                            onClick={() => appendDigit(digit)}
                            className="rounded-[1.05rem] border border-[rgba(22,50,41,0.1)] bg-white/88 px-4 py-2.5 text-2xl font-semibold text-[#163229] transition hover:bg-white sm:rounded-[1.2rem] sm:py-4"
                          >
                            {digit}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={clearCode}
                          className="rounded-[1.05rem] border border-[rgba(22,50,41,0.1)] bg-[rgba(22,50,41,0.06)] px-4 py-2.5 text-sm font-semibold text-[#163229] transition hover:bg-[rgba(22,50,41,0.1)] sm:rounded-[1.2rem] sm:py-4"
                        >
                          Effacer
                        </button>
                        <button
                          type="button"
                          onClick={() => appendDigit(shuffledDigits[9])}
                          className="rounded-[1.05rem] border border-[rgba(22,50,41,0.1)] bg-white/88 px-4 py-2.5 text-2xl font-semibold text-[#163229] transition hover:bg-white sm:rounded-[1.2rem] sm:py-4"
                        >
                          {shuffledDigits[9]}
                        </button>
                        <button
                          type="button"
                          onClick={removeDigit}
                          className="rounded-[1.05rem] border border-[rgba(22,50,41,0.1)] bg-[rgba(22,50,41,0.06)] px-4 py-2.5 text-sm font-semibold text-[#163229] transition hover:bg-[rgba(22,50,41,0.1)] sm:rounded-[1.2rem] sm:py-4"
                        >
                          Retour
                        </button>
                      </div>

                      <div className="mt-4 min-h-[2.75rem] text-center">
                        {loading ? (
                          <p className="text-sm font-semibold text-[rgba(22,50,41,0.72)]">
                            Vérification du code…
                          </p>
                        ) : error ? (
                          <p className="text-sm font-semibold text-[#a24d33]">{error}</p>
                        ) : (
                          <p className="text-sm text-[rgba(22,50,41,0.56)]">
                            Entre les 8 chiffres du code backend.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

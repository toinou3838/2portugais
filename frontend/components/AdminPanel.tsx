"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, RefreshCcw, Shield, X } from "lucide-react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { AdminDashboard } from "@/lib/types";

type AdminPanelProps = {
  open: boolean;
  onClose: () => void;
};

type AdminTab = "reminders" | "users" | "vocabulary" | "conjugations";

const tabLabels: Record<AdminTab, string> = {
  reminders: "Reminders",
  users: "Profils",
  vocabulary: "Vocabulaire",
  conjugations: "Conjugaison",
};

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

export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("reminders");
  const [shuffledDigits, setShuffledDigits] = useState<string[]>(() => shuffleDigits());

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

  async function loadDashboard(nextCode: string) {
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
      setTab("reminders");
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
  }

  function closePanel() {
    lockPanel();
    onClose();
  }

  async function refreshDashboard() {
    if (!activeCode) {
      return;
    }
    await loadDashboard(activeCode);
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
            <div className="grid h-full gap-5 overflow-y-auto pt-6">
              {stats ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                  {stats.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[1.35rem] border border-[rgba(22,50,41,0.08)] bg-white/80 px-4 py-4 shadow-soft"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-[rgba(22,50,41,0.42)]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-3xl font-semibold text-[#163229]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {(Object.keys(tabLabels) as AdminTab[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      tab === item
                        ? "bg-[#163229] text-white"
                        : "border border-[rgba(22,50,41,0.12)] bg-white/82 text-[#163229] hover:bg-white"
                    }`}
                  >
                    {tabLabels[item]}
                  </button>
                ))}
              </div>

              <div className="glass-panel shell-border overflow-hidden rounded-[1.8rem] shadow-soft">
                {tab === "reminders" ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[rgba(22,50,41,0.06)] text-left text-[rgba(22,50,41,0.66)]">
                        <tr>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Nom</th>
                          <th className="px-4 py-3">Streak</th>
                          <th className="px-4 py-3">Répondues</th>
                          <th className="px-4 py-3">Restantes</th>
                          <th className="px-4 py-3">Jour</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.pending_reminders.map((row) => (
                          <tr key={row.id} className="border-t border-[rgba(22,50,41,0.08)]">
                            <td className="px-4 py-3">{row.email}</td>
                            <td className="px-4 py-3">{row.display_name ?? "—"}</td>
                            <td className="px-4 py-3">{row.current_streak}</td>
                            <td className="px-4 py-3">{row.answered_questions}</td>
                            <td className="px-4 py-3">{row.remaining_questions}</td>
                            <td className="px-4 py-3">{row.day}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {dashboard.pending_reminders.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-[rgba(22,50,41,0.56)]">
                        Aucun utilisateur en attente de reminder.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {tab === "users" ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[rgba(22,50,41,0.06)] text-left text-[rgba(22,50,41,0.66)]">
                        <tr>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Nom</th>
                          <th className="px-4 py-3">Rappels</th>
                          <th className="px-4 py-3">Streak</th>
                          <th className="px-4 py-3">Répondues</th>
                          <th className="px-4 py-3">Correctes</th>
                          <th className="px-4 py-3">Quiz</th>
                          <th className="px-4 py-3">Objectif</th>
                          <th className="px-4 py-3">Reminder envoyé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.users.map((row) => (
                          <tr key={row.id} className="border-t border-[rgba(22,50,41,0.08)]">
                            <td className="px-4 py-3">{row.email}</td>
                            <td className="px-4 py-3">{row.display_name ?? "—"}</td>
                            <td className="px-4 py-3">{row.reminder_opt_in ? "Oui" : "Non"}</td>
                            <td className="px-4 py-3">{row.current_streak}</td>
                            <td className="px-4 py-3">{row.today_answered_questions}</td>
                            <td className="px-4 py-3">{row.today_correct_answers}</td>
                            <td className="px-4 py-3">{row.today_quizzes_completed}</td>
                            <td className="px-4 py-3">{row.today_goal_reached ? "Atteint" : "En cours"}</td>
                            <td className="px-4 py-3">{formatDate(row.today_reminder_sent_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {tab === "vocabulary" ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[rgba(22,50,41,0.06)] text-left text-[rgba(22,50,41,0.66)]">
                        <tr>
                          <th className="px-4 py-3">ID</th>
                          <th className="px-4 py-3">Français</th>
                          <th className="px-4 py-3">Portugais</th>
                          <th className="px-4 py-3">Direction</th>
                          <th className="px-4 py-3">Difficulté</th>
                          <th className="px-4 py-3">Créé par</th>
                          <th className="px-4 py-3">Créé le</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.vocabulary.map((row) => (
                          <tr key={row.id} className="border-t border-[rgba(22,50,41,0.08)]">
                            <td className="px-4 py-3">{row.id}</td>
                            <td className="px-4 py-3">{row.fr}</td>
                            <td className="px-4 py-3">{row.pt}</td>
                            <td className="px-4 py-3">{formatDirection(row.dir)}</td>
                            <td className="px-4 py-3">{row.difficulty}</td>
                            <td className="px-4 py-3">{row.created_by_user_id ?? "—"}</td>
                            <td className="px-4 py-3">{formatDate(row.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {tab === "conjugations" ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[rgba(22,50,41,0.06)] text-left text-[rgba(22,50,41,0.66)]">
                        <tr>
                          <th className="px-4 py-3">ID</th>
                          <th className="px-4 py-3">Français</th>
                          <th className="px-4 py-3">Portugais</th>
                          <th className="px-4 py-3">Direction</th>
                          <th className="px-4 py-3">Difficulté</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.conjugations.map((row) => (
                          <tr key={row.id} className="border-t border-[rgba(22,50,41,0.08)]">
                            <td className="px-4 py-3">{row.id}</td>
                            <td className="px-4 py-3">{row.fr}</td>
                            <td className="px-4 py-3">{row.pt}</td>
                            <td className="px-4 py-3">{formatDirection(row.dir)}</td>
                            <td className="px-4 py-3">{row.difficulty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="relative h-full min-h-0 overflow-hidden pt-2 sm:pt-4">
              <div className="pointer-events-none select-none blur-[14px] opacity-80">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 rounded-[1.35rem] border border-[rgba(22,50,41,0.08)] bg-white/80 px-4 py-4 shadow-soft"
                    />
                  ))}
                </div>
                <div className="mt-5 flex gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-10 w-28 rounded-full bg-[rgba(22,50,41,0.08)]"
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

              <div className="absolute inset-0 overflow-y-auto overscroll-contain touch-pan-y [scrollbar-gutter:stable] p-1 sm:p-4">
                <div className="flex min-h-full items-start justify-center py-0 sm:items-center sm:py-3">
                  <div className="glass-panel-strong shell-border my-auto w-full max-w-xl rounded-[2rem] p-4 shadow-card sm:rounded-[2.1rem] sm:p-6">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(22,50,41,0.08)] text-[#163229]">
                      <Shield className="h-8 w-8" />
                    </div>

                    <p className="mt-4 text-center text-xs uppercase tracking-[0.24em] text-[rgba(22,50,41,0.44)]">
                      Accès chiffré
                    </p>
                    <h3 className="section-title mt-2 text-center text-2xl font-semibold sm:text-3xl">
                      Déverrouille le panneau administrateur.
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-center text-sm leading-6 text-[rgba(22,50,41,0.6)]">
                      Le clavier numérique change d’emplacement à chaque ouverture.
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

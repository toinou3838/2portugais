"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, RefreshCcw, Shield, X } from "lucide-react";
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
  const [code, setCode] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("reminders");
  const [shuffledDigits, setShuffledDigits] = useState<string[]>(() => shuffleDigits());

  const unlocked = dashboard !== null && activeCode !== null;

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

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(12,24,20,0.38)] px-4 py-6 backdrop-blur-sm">
      <div className="glass-panel-strong shell-border relative flex max-h-[calc(100vh-3rem)] w-full max-w-[92rem] flex-col overflow-hidden rounded-[2.2rem] shadow-card">
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

        <div className="relative flex-1 overflow-hidden px-6 pb-6">
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
            <div className="relative h-full min-h-[42rem] overflow-hidden pt-6">
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

              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="glass-panel-strong shell-border w-full max-w-xl rounded-[2.3rem] p-6 shadow-card">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(22,50,41,0.08)] text-[#163229]">
                    <Shield className="h-8 w-8" />
                  </div>

                  <p className="mt-5 text-center text-xs uppercase tracking-[0.24em] text-[rgba(22,50,41,0.44)]">
                    Accès chiffré
                  </p>
                  <h3 className="section-title mt-2 text-center text-3xl font-semibold">
                    Déverrouille le panneau administrateur.
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-[rgba(22,50,41,0.6)]">
                    Le clavier numérique change d’emplacement à chaque ouverture.
                  </p>

                  <div className="mt-6 flex justify-center gap-3">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <span
                        key={index}
                        className={`h-4 w-4 rounded-full border ${
                          index < code.length
                            ? "border-[#163229] bg-[#163229]"
                            : "border-[rgba(22,50,41,0.18)] bg-transparent"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {shuffledDigits.slice(0, 9).map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => appendDigit(digit)}
                        className="rounded-[1.2rem] border border-[rgba(22,50,41,0.1)] bg-white/88 px-4 py-4 text-2xl font-semibold text-[#163229] transition hover:bg-white"
                      >
                        {digit}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={clearCode}
                      className="rounded-[1.2rem] border border-[rgba(22,50,41,0.1)] bg-[rgba(22,50,41,0.06)] px-4 py-4 text-sm font-semibold text-[#163229] transition hover:bg-[rgba(22,50,41,0.1)]"
                    >
                      Effacer
                    </button>
                    <button
                      type="button"
                      onClick={() => appendDigit(shuffledDigits[9])}
                      className="rounded-[1.2rem] border border-[rgba(22,50,41,0.1)] bg-white/88 px-4 py-4 text-2xl font-semibold text-[#163229] transition hover:bg-white"
                    >
                      {shuffledDigits[9]}
                    </button>
                    <button
                      type="button"
                      onClick={removeDigit}
                      className="rounded-[1.2rem] border border-[rgba(22,50,41,0.1)] bg-[rgba(22,50,41,0.06)] px-4 py-4 text-sm font-semibold text-[#163229] transition hover:bg-[rgba(22,50,41,0.1)]"
                    >
                      Retour
                    </button>
                  </div>

                  <div className="mt-5 min-h-[2.75rem] text-center">
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
          )}
        </div>
      </div>
    </div>
  );
}


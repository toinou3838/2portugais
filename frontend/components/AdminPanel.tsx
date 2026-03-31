"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Eye, KeyRound, RefreshCcw, Shield, X } from "lucide-react";
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

const storageKey = "o-mestre-admin-code";

function formatDirection(value: 0 | 1) {
  return value === 0 ? "fr -> pt" : "pt -> fr";
}

export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const [code, setCode] = useState("");
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("reminders");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored) {
      setSavedCode(stored);
      setCode(stored);
    }
  }, []);

  useEffect(() => {
    if (!open || !savedCode || dashboard) {
      return;
    }
    void loadDashboard(savedCode);
  }, [dashboard, open, savedCode]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  const stats = useMemo(() => {
    if (!dashboard) {
      return null;
    }
    return {
      reminders: dashboard.pending_reminders.length,
      users: dashboard.users.length,
      vocabulary: dashboard.vocabulary.length,
      conjugations: dashboard.conjugations.length,
    };
  }, [dashboard]);
  const unlocked = dashboard !== null;

  async function loadDashboard(activeCode: string) {
    setLoading(true);
    setError(null);
    try {
      await apiFetch<{ ok: boolean }>("/admin/verify", { adminCode: activeCode });
      const data = await apiFetch<AdminDashboard>("/admin/dashboard", {
        adminCode: activeCode,
      });
      setDashboard(data);
      setSavedCode(activeCode);
      window.sessionStorage.setItem(storageKey, activeCode);
    } catch (requestError) {
      setDashboard(null);
      setSavedCode(null);
      window.sessionStorage.removeItem(storageKey);
      setError(
        requestError instanceof Error ? requestError.message : "Accès admin impossible.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadDashboard(code);
  }

  function handleLogout() {
    setSavedCode(null);
    setDashboard(null);
    setCode("");
    setError(null);
    window.sessionStorage.removeItem(storageKey);
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(12,24,20,0.38)] px-4 py-6 backdrop-blur-sm">
      <div className="glass-panel-strong shell-border relative flex max-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[2.2rem] shadow-card">
        <div className="flex items-center justify-between border-b border-[rgba(22,50,41,0.08)] px-6 py-5">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[rgba(22,50,41,0.42)]">
              Panneau admin
            </p>
            <h2 className="section-title mt-2 text-3xl font-semibold">
              {unlocked
                ? "Vue directe des données et des reminders."
                : "Interface administrateur verrouillée."}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(22,50,41,0.12)] bg-white/80 text-[#163229] transition hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="glass-panel shell-border flex flex-col gap-4 rounded-[1.8rem] p-5 shadow-soft">
            <div className="flex items-center gap-3 rounded-[1.4rem] bg-[rgba(22,50,41,0.06)] px-4 py-3">
              <Shield className="h-5 w-5 text-[#163229]" />
              <div>
                <p className="text-sm font-semibold text-[#163229]">Accès protégé</p>
                <p className="text-xs text-[rgba(22,50,41,0.58)]">Code backend à 8 chiffres</p>
              </div>
            </div>

            <form className="grid gap-3" onSubmit={handleSubmit}>
              <label className="text-sm font-semibold text-[rgba(22,50,41,0.74)]">
                Code admin
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(22,50,41,0.44)]" />
                <input
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="12345678"
                  className="w-full rounded-[1rem] border border-[rgba(22,50,41,0.12)] bg-white/88 py-3 pl-11 pr-4 text-base text-[#163229] outline-none transition focus:border-[rgba(22,50,41,0.28)]"
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 8}
                className="rounded-[1rem] bg-[#163229] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#21453a] disabled:cursor-not-allowed disabled:bg-[rgba(22,50,41,0.38)]"
              >
                {loading ? "Chargement..." : "Ouvrir le panneau"}
              </button>
            </form>

            {error ? (
              <div className="rounded-[1rem] border border-[rgba(200,109,79,0.28)] bg-[rgba(200,109,79,0.08)] px-4 py-3 text-sm text-[#a24d33]">
                {error}
              </div>
            ) : null}

            {stats ? (
              <div className="grid gap-3">
                <div className="rounded-[1.1rem] bg-[rgba(185,119,63,0.1)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-[rgba(22,50,41,0.42)]">
                    En attente
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[#163229]">
                    {stats.reminders}
                  </p>
                </div>
                <div className="rounded-[1.1rem] bg-[rgba(22,50,41,0.06)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-[rgba(22,50,41,0.42)]">
                    Profils chargés
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[#163229]">{stats.users}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-auto flex gap-3">
              <button
                type="button"
                onClick={() => savedCode && void loadDashboard(savedCode)}
                disabled={!savedCode || loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-[1rem] border border-[rgba(22,50,41,0.12)] bg-white/80 px-3 py-3 text-sm font-semibold text-[#163229] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Actualiser
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-[1rem] border border-[rgba(22,50,41,0.12)] bg-white/80 px-4 py-3 text-sm font-semibold text-[#163229] transition hover:bg-white"
              >
                Fermer la session
              </button>
            </div>
          </aside>

          <section className="grid min-h-[32rem] gap-4">
            {unlocked ? (
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
            ) : (
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-10 w-28 rounded-full bg-[rgba(22,50,41,0.08)]"
                  />
                ))}
              </div>
            )}

            <div className="glass-panel shell-border relative overflow-hidden rounded-[1.8rem] shadow-soft">
              {dashboard ? (
                <>
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
                            <th className="px-4 py-3">Aujourd’hui</th>
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
                              <td className="px-4 py-3">{row.today_goal_reached ? "Atteint" : "En cours"}</td>
                              <td className="px-4 py-3">{row.today_reminder_sent_at ?? "—"}</td>
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
                              <td className="px-4 py-3">{new Date(row.created_at).toLocaleString()}</td>
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
                </>
              ) : (
                <div className="relative min-h-[26rem]">
                  <div className="pointer-events-none select-none blur-[10px]">
                    <div className="border-b border-[rgba(22,50,41,0.08)] bg-[rgba(22,50,41,0.04)] px-5 py-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-20 rounded-[1.3rem] bg-[rgba(22,50,41,0.08)]"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="overflow-hidden px-4 py-4">
                      <div className="grid gap-3">
                        {Array.from({ length: 8 }).map((_, rowIndex) => (
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

                  <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                    <div className="rounded-full bg-[rgba(22,50,41,0.08)] p-4">
                      <Eye className="h-8 w-8 text-[rgba(22,50,41,0.42)]" />
                    </div>
                    <p className="mt-5 text-lg font-semibold text-[#163229]">
                      Entre le code admin pour révéler le panneau.
                    </p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[rgba(22,50,41,0.56)]">
                      Tant que le code n’est pas validé, l’interface reste volontairement brouillée.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

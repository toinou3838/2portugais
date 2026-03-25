"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { AlertTriangle, CheckCircle2, DatabaseZap, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { VocabularyCheckResponse, VocabularyEntry } from "@/lib/types";

function getTemplate() {
  return process.env.NEXT_PUBLIC_CLERK_TOKEN_TEMPLATE;
}

type FormState = {
  fr: string;
  pt: string;
};

const initialState: FormState = {
  fr: "",
  pt: "",
};

export function VocabularyAdminPanel() {
  const { getToken } = useAuth();
  const { isSignedIn } = useUser();
  const [form, setForm] = useState<FormState>(initialState);
  const [checkResult, setCheckResult] = useState<VocabularyCheckResponse | null>(null);
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function requireToken() {
    const token = await getToken(getTemplate() ? { template: getTemplate() } : undefined);
    if (!token) {
      throw new Error("Connexion Clerk requise");
    }
    return token;
  }

  useEffect(() => {
    if (!isSignedIn) {
      setEntries([]);
      return;
    }

    async function loadEntries() {
      try {
        const token = await getToken(getTemplate() ? { template: getTemplate() } : undefined);
        if (!token) {
          return;
        }
        const data = await apiFetch<VocabularyEntry[]>("/vocabulary?limit=6", {
          token,
        });
        setEntries(data);
      } catch (error) {
        console.error(error);
      }
    }

    void loadEntries();
  }, [getToken, isSignedIn]);

  async function handleCheck() {
    if (!form.fr.trim() || !form.pt.trim()) {
      return;
    }

    try {
      const token = await requireToken();
      const data = await apiFetch<VocabularyCheckResponse>("/vocabulary/check", {
        method: "POST",
        token,
        body: JSON.stringify({
          fr: form.fr,
          pt: form.pt,
        }),
      });
      setCheckResult(data);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vérification impossible.");
    }
  }

  async function saveEntry(recommendation = false) {
    setSaving(true);
    setMessage(null);

    try {
      const token = await requireToken();
      const payload = recommendation && checkResult?.recommendation
        ? checkResult.recommendation
        : form;

      const entry = await apiFetch<VocabularyEntry>("/vocabulary", {
        method: "POST",
        token,
        body: JSON.stringify({
          fr: payload.fr,
          pt: payload.pt,
          force_add: recommendation || !checkResult?.is_consistent,
        }),
      });
      setEntries((current) => [entry, ...current].slice(0, 6));
      setForm(initialState);
      setCheckResult(null);
      setMessage("Le mot a été ajouté à la base persistante.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ajout impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (!isSignedIn) {
    return (
      <section className="glass-panel shell-border rounded-[2rem] p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.22em] text-[rgba(22,50,41,0.48)]">
          Admin vocabulaire
        </p>
        <h2 className="section-title mt-2 text-3xl font-semibold">
          Panneau protégé.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[rgba(22,50,41,0.66)]">
          Connecte-toi avec Clerk pour vérifier une paire, accepter une recommandation
          et enrichir la base Postgres.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel shell-border rounded-[2rem] p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[rgba(22,50,41,0.48)]">
            Admin vocabulaire
          </p>
          <h2 className="section-title mt-2 text-3xl font-semibold">
            Ajoute une paire avec contrôle de cohérence.
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(185,119,63,0.14)] px-4 py-2 text-sm font-semibold text-[#9e6230]">
          <DatabaseZap className="h-4 w-4" />
          Postgres comme source principale
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveEntry(false);
          }}
          className="space-y-4 rounded-[1.6rem] bg-white/82 p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[rgba(22,50,41,0.6)]">
                Français
              </span>
              <input
                value={form.fr}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fr: event.target.value }))
                }
                className="w-full rounded-[1.2rem] border border-[rgba(22,50,41,0.08)] bg-[#fffdf9] px-4 py-3 outline-none focus:border-[rgba(22,50,41,0.18)]"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[rgba(22,50,41,0.6)]">
                Portugais
              </span>
              <input
                value={form.pt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, pt: event.target.value }))
                }
                className="w-full rounded-[1.2rem] border border-[rgba(22,50,41,0.08)] bg-[#fffdf9] px-4 py-3 outline-none focus:border-[rgba(22,50,41,0.18)]"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleCheck()}
              className="rounded-full border border-[rgba(22,50,41,0.12)] bg-white px-5 py-3 text-sm font-semibold text-[#163229] transition hover:bg-[#f8f3eb]"
            >
              Vérifier la cohérence
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#163229] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#21453a] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Ajouter quand même
            </button>
          </div>

          {message ? (
            <p className="text-sm text-[rgba(22,50,41,0.64)]">{message}</p>
          ) : null}
        </form>

        <div className="space-y-4">
          <div className="rounded-[1.6rem] bg-[#163229] p-5 text-white">
            <p className="text-sm uppercase tracking-[0.18em] text-white/56">
              Contrôle automatique
            </p>
            {checkResult ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3">
                  {checkResult.is_consistent ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#b8d0b9]" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-[#f0bc9f]" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {checkResult.is_consistent
                        ? "La paire semble cohérente."
                        : "La paire est potentiellement incohérente."}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      {checkResult.warning ?? "Aucune alerte détectée."}
                    </p>
                  </div>
                </div>
                {checkResult.recommendation ? (
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/8 p-4">
                    <p className="text-sm text-white/56">Recommandation</p>
                    <p className="mt-2 font-semibold">
                      {checkResult.recommendation.fr} → {checkResult.recommendation.pt}
                    </p>
                    <button
                      type="button"
                      onClick={() => void saveEntry(true)}
                      className="mt-4 rounded-full bg-[#f7efe2] px-4 py-2 text-sm font-semibold text-[#163229] transition hover:bg-white"
                    >
                      Ajouter la recommandation
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/70">
                Lance une vérification pour comparer la paire saisie avec les services
                de traduction encapsulés et le vocabulaire existant.
              </p>
            )}
          </div>

          <div className="rounded-[1.6rem] border border-[rgba(22,50,41,0.08)] bg-white/82 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-[rgba(22,50,41,0.48)]">
              Derniers ajouts
            </p>
            <div className="mt-4 space-y-3">
              {entries.length > 0 ? (
                entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[1.2rem] border border-[rgba(22,50,41,0.08)] bg-[#fffdf9] p-4"
                  >
                    <p className="font-semibold">
                      {entry.fr} → {entry.pt}
                    </p>
                    <p className="mt-1 text-sm text-[rgba(22,50,41,0.58)]">
                      direction initiale {entry.dir === 0 ? "fr → pt" : "pt → fr"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-[rgba(22,50,41,0.62)]">
                  Aucun ajout sur cette session. Les nouvelles paires apparaîtront ici.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

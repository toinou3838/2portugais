"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
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
        const data = await apiFetch<VocabularyEntry[]>("/vocabulary?limit=3", {
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
      setEntries((current) => [entry, ...current].slice(0, 3));
      setForm(initialState);
      setMessage(
        recommendation
          ? "La recommandation distante a été ajoutée à la base."
          : "Le mot a été ajouté à la base persistante.",
      );
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
          Ajout de vocabulaire
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
            Ajout de vocabulaire
          </p>
          <h2 className="section-title mt-2 text-3xl font-semibold">
            Ajoute une paire avec contrôle de cohérence.
          </h2>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveEntry(false);
          }}
          className="space-y-5 rounded-[1.6rem] bg-white/82 p-5"
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem] xl:items-end">
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
            <div className="flex flex-col gap-3 xl:items-stretch">
              <button
                type="button"
                onClick={() => void handleCheck()}
                className="w-full rounded-full border border-[rgba(22,50,41,0.12)] bg-white px-5 py-3 text-sm font-semibold text-[#163229] transition hover:bg-[#f8f3eb]"
              >
                Vérifier la cohérence
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#163229] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#21453a] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Ajouter quand même
              </button>
            </div>
          </div>

          {checkResult ? (
            <div className="rounded-[1.3rem] border border-[rgba(22,50,41,0.08)] bg-[#fffdf9] p-4">
              <div className="flex items-start gap-3">
                {checkResult.is_consistent ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#1f6e38]" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-[#a16207]" />
                )}
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-[#163229]">
                    {checkResult.is_consistent
                      ? "La paire est cohérente avec la traduction distante."
                      : "La paire ne correspond pas exactement à la suggestion distante."}
                  </p>
                  <p className="text-[rgba(22,50,41,0.68)]">
                    {checkResult.warning ??
                      `Vérifié via ${checkResult.provider}.`}
                  </p>
                  {checkResult.recommendation ? (
                    <button
                      type="button"
                      onClick={() => void saveEntry(true)}
                      className="rounded-full bg-[#163229] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#21453a]"
                    >
                      Ajouter la recommandation
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {message ? (
            <p className="text-sm text-[rgba(22,50,41,0.64)]">{message}</p>
          ) : null}
        </form>

        <div className="rounded-[1.6rem] border border-[rgba(22,50,41,0.08)] bg-white/82 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.18em] text-[rgba(22,50,41,0.48)]">
              Derniers ajouts
            </p>
            <p className="text-sm text-[rgba(22,50,41,0.58)]">
              Les 3 dernières paires enregistrées.
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {entries.length > 0 ? (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[1.2rem] border border-[rgba(22,50,41,0.08)] bg-[#fffdf9] p-4"
                >
                  <p className="font-semibold">
                    {entry.fr} → {entry.pt}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-[rgba(22,50,41,0.62)] md:col-span-3">
                Aucun ajout sur cette session. Les nouvelles paires apparaîtront ici.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { ArrowRightLeft, ChevronDown, Languages } from "lucide-react";
import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DifficultyLevel, TranslationDirection, TranslationResponse } from "@/lib/types";
import { getDifficultyLabel } from "@/lib/utils";

function getTemplate() {
  return process.env.NEXT_PUBLIC_CLERK_TOKEN_TEMPLATE;
}

export function TranslatorPanel() {
  const { getToken } = useAuth();
  const { isSignedIn } = useUser();
  const [direction, setDirection] = useState<TranslationDirection>("fr_to_pt");
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState<TranslationResponse | null>(null);
  const [translating, setTranslating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [pendingDifficulty, setPendingDifficulty] = useState("");
  const queryKey = useMemo(() => `${direction}::${text.trim().toLowerCase()}`, [direction, text]);
  const [lastRequestedKey, setLastRequestedKey] = useState("");

  useEffect(() => {
    if (!text.trim()) {
      setTranslation(null);
      setLastRequestedKey("");
      return;
    }
  }, [text]);

  const requestTranslation = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setTranslation(null);
      return;
    }

    setTranslating(true);
    setMessage(null);

    try {
      const data = await apiFetch<TranslationResponse>("/translate", {
        method: "POST",
        body: JSON.stringify({
          text: trimmed,
          direction,
        }),
      });
      setTranslation(data);
      setLastRequestedKey(queryKey);
    } catch (error) {
      setTranslation(null);
      setMessage(error instanceof Error ? error.message : "Traduction impossible.");
    } finally {
      setTranslating(false);
    }
  }, [direction, queryKey, text]);

  useEffect(() => {
    if (!isFocused || !text.trim() || queryKey === lastRequestedKey) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void requestTranslation();
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [isFocused, lastRequestedKey, queryKey, text, direction, requestTranslation]);

  async function handleAddPair(difficulty: DifficultyLevel) {
    if (!isSignedIn || !translation?.translated_text || !text.trim()) {
      return;
    }

    setAdding(true);
    setMessage(null);
    setPendingDifficulty("");

    try {
      const token = await getToken(getTemplate() ? { template: getTemplate() } : undefined);
      if (!token) {
        throw new Error("Token Clerk indisponible");
      }

      const payload =
        direction === "fr_to_pt"
          ? {
              fr: text.trim().toLowerCase(),
              pt: translation.translated_text,
              difficulty,
            }
          : {
              fr: translation.translated_text,
              pt: text.trim().toLowerCase(),
              difficulty,
            };

      await apiFetch("/vocabulary", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      setMessage(`La paire a été ajoutée en niveau ${getDifficultyLabel(difficulty).toLowerCase()}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ajout impossible.");
    } finally {
      setAdding(false);
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void requestTranslation();
    }
  }

  return (
    <section className="glass-panel shell-border rounded-[2rem] p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[rgba(22,50,41,0.48)]">
            Traduction intégrée
          </p>
          <h2 className="section-title mt-2 text-3xl font-semibold">
            Vérifie un mot à la frappe.
          </h2>
        </div>
        <button
          type="button"
          onClick={() =>
            setDirection((current) =>
              current === "fr_to_pt" ? "pt_to_fr" : "fr_to_pt",
            )
          }
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(22,50,41,0.12)] bg-white/82 px-4 py-2.5 text-sm font-semibold text-[#163229] transition hover:bg-white"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Inverser
        </button>
      </div>

      <div className="mt-6 grid items-stretch gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <label className="flex h-[24rem] flex-col rounded-[1.6rem] border border-[rgba(22,50,41,0.08)] bg-[rgba(255,255,255,0.42)] p-5">
          <p className="text-sm font-semibold text-[rgba(22,50,41,0.6)]">
            {direction === "fr_to_pt" ? "Entrée française" : "Entrée portugaise"}
          </p>
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setPendingDifficulty("");
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={
              direction === "fr_to_pt"
                ? "ex. prendre l'habitude"
                : "ex. levar jeito"
            }
            className="mt-4 min-h-0 flex-1 resize-none rounded-[1.4rem] border border-[rgba(22,50,41,0.08)] bg-transparent px-4 py-4 outline-none focus:border-[rgba(22,50,41,0.18)]"
          />
        </label>

        <div className="flex h-[24rem] flex-col rounded-[1.6rem] bg-[#163229] p-5 text-white">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-white/56">
            <Languages className="h-4 w-4" />
            Résultat live
          </div>
          <div className="mt-6 flex min-h-0 flex-[0.82] flex-col rounded-[1.4rem] border border-white/10 bg-transparent p-5">
            <p className="text-sm text-white/52">
              {translation?.provider
                ? `Source ${translation.provider}`
                : translating
                  ? "Traduction en cours..."
                  : "Entrée pour traduire ou appuie sur Entrée"}
            </p>
            {translation?.translated_text ? (
              <p className="section-title mt-4 text-3xl font-semibold">
                {translation.translated_text}
              </p>
            ) : null}
            {translation ? (
              <p className="mt-auto pt-4 text-sm text-white/64">
                Confiance {Math.round(translation.confidence * 100)}%
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <div className="relative inline-block">
              <select
                value={pendingDifficulty}
                disabled={!translation?.translated_text || !isSignedIn || adding}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setPendingDifficulty(nextValue);
                  if (!nextValue) {
                    return;
                  }
                  const level = Number(nextValue) as DifficultyLevel;
                  void handleAddPair(level);
                }}
                className="min-w-[18rem] appearance-none rounded-full border border-white/10 bg-[#f7efe2] px-5 py-3 pr-11 text-sm font-semibold text-[#163229] outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                <option value="" disabled>
                  Difficulté
                </option>
                <option value={1}>Facile</option>
                <option value={2}>Intermédiaire</option>
                <option value={3}>Difficile</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#163229]" />
            </div>
            {!isSignedIn ? (
              <p className="text-sm text-white/68">
                Connecte-toi pour enregistrer la paire en base.
              </p>
            ) : null}
          </div>
          {message ? <p className="mt-4 text-sm text-white/72">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}

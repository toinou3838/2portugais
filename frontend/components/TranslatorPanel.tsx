"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { ArrowRightLeft, Languages, Plus } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
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
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(2);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const deferredText = useDeferredValue(text);

  useEffect(() => {
    if (!deferredText.trim()) {
      setTranslation(null);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        const data = await apiFetch<TranslationResponse>("/translate", {
          method: "POST",
          body: JSON.stringify({
            text: deferredText,
            direction,
          }),
        });
        setTranslation(data);
      } catch (error) {
        console.error(error);
      }
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [deferredText, direction]);

  async function handleAddPair() {
    if (!isSignedIn || !translation?.translated_text || !text.trim()) {
      return;
    }

    setAdding(true);
    setMessage(null);

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
      setMessage("La paire a été ajoutée à la base de vocabulaire.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ajout impossible.");
    } finally {
      setAdding(false);
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
        <label className="flex h-[22rem] flex-col rounded-[1.6rem] border border-[rgba(22,50,41,0.08)] bg-[rgba(255,255,255,0.42)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[rgba(22,50,41,0.6)]">
              {direction === "fr_to_pt" ? "Entrée française" : "Entrée portugaise"}
            </p>
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(Number(event.target.value) as DifficultyLevel)}
              className="rounded-full border border-[rgba(22,50,41,0.08)] bg-[#fffdf9] px-3 py-1.5 text-sm font-semibold text-[#163229] outline-none"
            >
              <option value={1}>Facile</option>
              <option value={2}>Intermédiaire</option>
              <option value={3}>Difficile</option>
            </select>
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              direction === "fr_to_pt"
                ? "ex. prendre l'habitude"
                : "ex. levar jeito"
            }
            className="mt-4 min-h-0 flex-1 resize-none rounded-[1.4rem] border border-[rgba(22,50,41,0.08)] bg-transparent px-4 py-4 outline-none focus:border-[rgba(22,50,41,0.18)]"
          />
        </label>

        <div className="flex h-[22rem] flex-col rounded-[1.6rem] bg-[#163229] p-5 text-white">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-white/56">
            <Languages className="h-4 w-4" />
            Résultat live
          </div>
          <div className="mt-6 flex flex-1 flex-col rounded-[1.4rem] border border-white/10 bg-transparent p-5">
            <p className="text-sm text-white/52">
              {translation?.provider
                ? `Source ${translation.provider}`
                : "Aucune requête tant que le champ est vide"}
            </p>
            <p className="section-title mt-4 text-3xl font-semibold">
              {translation?.translated_text ?? "la traduction apparaîtra ici"}
            </p>
            {translation ? (
              <p className="mt-auto pt-4 text-sm text-white/64">
                Confiance {Math.round(translation.confidence * 100)}% ·{" "}
                {translation.found ? "réponse issue d’un service distant" : "suggestion faible"}
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleAddPair}
              disabled={!translation?.translated_text || !isSignedIn || adding}
              className="inline-flex items-center gap-2 rounded-full bg-[#f7efe2] px-5 py-3 text-sm font-semibold text-[#163229] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Ajouter la paire
            </button>
            <span className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white/84">
              {getDifficultyLabel(difficulty)}
            </span>
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

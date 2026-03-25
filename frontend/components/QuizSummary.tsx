"use client";

import { RotateCcw, Shuffle, Trophy } from "lucide-react";
import { QuizGenerationResponse, QuizSummaryStats } from "@/lib/types";

type QuizSummaryProps = {
  summary: QuizSummaryStats;
  quiz: QuizGenerationResponse;
  saving: boolean;
  syncMessage: string | null;
  onNewQuiz: () => void;
  onFlipDirections: () => void;
};

export function QuizSummary({
  summary,
  quiz,
  saving,
  syncMessage,
  onNewQuiz,
  onFlipDirections,
}: QuizSummaryProps) {
  return (
    <section className="glass-panel shell-border rounded-[2rem] p-6 shadow-card">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[1.8rem] bg-[#163229] p-6 text-white">
          <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
            Quiz terminé
          </div>
          <h2 className="section-title mt-5 text-5xl font-semibold">
            {summary.scorePercent}%
          </h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-white/72">
            {summary.correct} bonnes réponses, {summary.incorrect} incorrectes et{" "}
            {summary.skipped} non répondues sur {summary.total} questions.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/8 p-4">
              <p className="text-sm text-white/56">Vocabulaire</p>
              <p className="mt-2 text-2xl font-semibold">
                {quiz.source_breakdown.vocab}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/8 p-4">
              <p className="text-sm text-white/56">Conjugaison</p>
              <p className="mt-2 text-2xl font-semibold">
                {quiz.source_breakdown.conjugaison}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/8 p-4">
              <p className="text-sm text-white/56">Score final</p>
              <p className="mt-2 text-2xl font-semibold">{summary.correct}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-[1.8rem] bg-white/82 p-6">
          <div className="flex items-center gap-3 text-[#163229]">
            <Trophy className="h-5 w-5" />
            <p className="font-semibold">Relance ou inverse immédiatement le sens.</p>
          </div>
          <p className="text-sm leading-6 text-[rgba(22,50,41,0.66)]">
            Le bouton d’inversion repart du même lot de cartes avec les directions
            retournées. Le bouton nouveau quiz relance un tirage complet.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onFlipDirections}
              className="inline-flex items-center gap-2 rounded-full bg-[#163229] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#21453a]"
            >
              <RotateCcw className="h-4 w-4" />
              Inverser le sens
            </button>
            <button
              type="button"
              onClick={onNewQuiz}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(22,50,41,0.12)] bg-white px-5 py-3 text-sm font-semibold text-[#163229] transition hover:bg-[#f8f3eb]"
            >
              <Shuffle className="h-4 w-4" />
              Nouveau quiz
            </button>
          </div>
          <p className="text-sm text-[rgba(22,50,41,0.58)]">
            {saving ? "Synchronisation de la progression..." : syncMessage}
          </p>
        </div>
      </div>
    </section>
  );
}


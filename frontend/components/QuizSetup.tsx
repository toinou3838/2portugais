"use client";

import { DifficultyLevel } from "@/lib/types";
import { getDifficultyLabel } from "@/lib/utils";

type QuizSetupProps = {
  questionCount: number;
  conjugationPercentage: number;
  difficulty: DifficultyLevel;
  loading: boolean;
  canGenerateReview: boolean;
  message?: string | null;
  onQuestionCountChange: (value: number) => void;
  onConjugationPercentageChange: (value: number) => void;
  onDifficultyChange: (value: DifficultyLevel) => void;
  onGenerateStandard: () => void;
  onGenerateReview: () => void;
};

export function QuizSetup({
  questionCount,
  conjugationPercentage,
  difficulty,
  loading,
  canGenerateReview,
  message,
  onQuestionCountChange,
  onConjugationPercentageChange,
  onDifficultyChange,
  onGenerateStandard,
  onGenerateReview,
}: QuizSetupProps) {
  return (
    <section className="glass-panel shell-border rounded-[2rem] p-6 shadow-soft">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[rgba(22,50,41,0.48)]">
            Paramètres du quiz
          </p>
          <h2 className="section-title mt-2 text-3xl font-semibold">
            Compose une série sur mesure.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[rgba(22,50,41,0.64)]">
            Le quiz de révision reprend les paires déjà réussies plusieurs fois, une
            fois que tu en maîtrises suffisamment dans les deux sens.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onGenerateStandard}
            disabled={loading}
            className="rounded-full bg-[#163229] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#21453a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Génération..." : "Lancer un quiz"}
          </button>
          <button
            type="button"
            onClick={onGenerateReview}
            disabled={loading || !canGenerateReview}
            className="rounded-full border border-[rgba(22,50,41,0.12)] bg-white px-5 py-3 text-sm font-semibold text-[#163229] transition hover:bg-[#f8f3eb] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Quiz de révision
          </button>
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-[1.25rem] border border-[rgba(169,81,47,0.16)] bg-[rgba(247,239,226,0.9)] px-4 py-3 text-sm font-medium text-[#9e6230]">
          {message}
        </div>
      ) : null}

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <label className="shell-border rounded-[1.6rem] bg-white/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[rgba(22,50,41,0.58)]">
              Nombre de questions
            </span>
            <span className="rounded-full bg-[rgba(22,50,41,0.08)] px-3 py-1 text-sm font-semibold">
              {questionCount}
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={200}
            step={5}
            value={questionCount}
            onChange={(event) => onQuestionCountChange(Number(event.target.value))}
            className="mt-6 w-full accent-[#163229]"
          />
          <div className="mt-4 flex justify-between text-xs uppercase tracking-[0.16em] text-[rgba(22,50,41,0.46)]">
            <span>court</span>
            <span>intensif</span>
          </div>
        </label>

        <label className="shell-border rounded-[1.6rem] bg-white/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[rgba(22,50,41,0.58)]">
              Part de conjugaison
            </span>
            <span className="rounded-full bg-[rgba(185,119,63,0.14)] px-3 py-1 text-sm font-semibold text-[#9e6230]">
              {conjugationPercentage}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={80}
            step={5}
            value={conjugationPercentage}
            onChange={(event) => onConjugationPercentageChange(Number(event.target.value))}
            className="mt-6 w-full accent-[#b9773f]"
          />
          <div className="mt-4 flex justify-between text-xs uppercase tracking-[0.16em] text-[rgba(22,50,41,0.46)]">
            <span>tout vocab</span>
            <span>mixte</span>
          </div>
        </label>

        <label className="shell-border rounded-[1.6rem] bg-white/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[rgba(22,50,41,0.58)]">
              Difficulté visée
            </span>
            <span className="rounded-full bg-[rgba(22,50,41,0.08)] px-3 py-1 text-sm font-semibold">
              {getDifficultyLabel(difficulty)}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={difficulty}
            onChange={(event) =>
              onDifficultyChange(Number(event.target.value) as DifficultyLevel)
            }
            className="mt-6 w-full accent-[#b9773f]"
          />
          <div className="mt-4 flex justify-between text-xs uppercase tracking-[0.16em] text-[rgba(22,50,41,0.46)]">
            <span>Ez</span>
            <span>Galère</span>
          </div>
        </label>
      </div>
    </section>
  );
}

"use client";

import { ChevronLeft, ChevronRight, CircleDashed, Flame, SkipForward } from "lucide-react";
import { QuizAnswerState, QuizItem, QuizSummaryStats } from "@/lib/types";
import { getDirectionLabel, getPromptLabel, getPromptValue, getSourceBadge } from "@/lib/utils";
import { QuizProgress } from "@/components/QuizProgress";

type QuizRunnerProps = {
  items: QuizItem[];
  answers: QuizAnswerState[];
  currentIndex: number;
  draftAnswer: string;
  summary: QuizSummaryStats;
  onDraftAnswerChange: (value: string) => void;
  onValidate: () => void;
  onSkip: () => void;
  onSelectQuestion: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
};

function getStatusClasses(status: QuizAnswerState["status"]): string {
  switch (status) {
    case "correct":
      return "bg-[rgba(93,122,103,0.16)] text-[#375544] border-[rgba(93,122,103,0.24)]";
    case "incorrect":
      return "bg-[rgba(200,109,79,0.12)] text-[#a8583f] border-[rgba(200,109,79,0.22)]";
    case "skipped":
      return "bg-[rgba(185,119,63,0.14)] text-[#9e6230] border-[rgba(185,119,63,0.2)]";
    default:
      return "bg-[rgba(22,50,41,0.06)] text-[rgba(22,50,41,0.6)] border-[rgba(22,50,41,0.12)]";
  }
}

function getStatusLabel(status: QuizAnswerState["status"]): string {
  switch (status) {
    case "correct":
      return "Correct";
    case "incorrect":
      return "Incorrect";
    case "skipped":
      return "Passée";
    default:
      return "À faire";
  }
}

export function QuizRunner({
  items,
  answers,
  currentIndex,
  draftAnswer,
  summary,
  onDraftAnswerChange,
  onValidate,
  onSkip,
  onSelectQuestion,
  onPrevious,
  onNext,
}: QuizRunnerProps) {
  const item = items[currentIndex];
  const answerState = answers[currentIndex];

  return (
    <section className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
      <div className="glass-panel shell-border rounded-[2rem] p-6 shadow-card">
        <QuizProgress currentIndex={currentIndex} answers={answers} summary={summary} />

        <div className="mt-6 rounded-[1.8rem] bg-[#163229] p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="status-pill bg-white/10 text-white">
              {getDirectionLabel(item.dir)}
            </span>
            <span className="status-pill bg-white/10 text-white">
              {getSourceBadge(item.source)}
            </span>
          </div>

          <p className="mt-8 text-sm uppercase tracking-[0.22em] text-white/58">
            {getPromptLabel(item.dir)}
          </p>
          <h2 className="section-title mt-3 text-4xl font-semibold sm:text-5xl">
            {getPromptValue(item)}
          </h2>

          <label className="mt-8 block">
            <span className="sr-only">Réponse</span>
            <input
              value={draftAnswer}
              onChange={(event) => onDraftAnswerChange(event.target.value)}
              placeholder="Tape ta réponse..."
              className="w-full rounded-[1.4rem] border border-white/12 bg-white/10 px-5 py-4 text-lg text-white outline-none placeholder:text-white/44 focus:border-white/28"
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onValidate}
              disabled={!draftAnswer.trim()}
              className="rounded-full bg-[#f7efe2] px-5 py-3 text-sm font-semibold text-[#163229] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Valider
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
            >
              Passer
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
          <div
            className={`rounded-[1.6rem] border p-5 ${getStatusClasses(answerState.status)}`}
          >
            <p className="text-sm uppercase tracking-[0.18em]">État de la question</p>
            <div className="mt-3 flex items-center gap-2 text-lg font-semibold">
              {answerState.status === "correct" && <Flame className="h-4 w-4" />}
              {answerState.status === "pending" && <CircleDashed className="h-4 w-4" />}
              {answerState.status === "skipped" && <SkipForward className="h-4 w-4" />}
              {getStatusLabel(answerState.status)}
            </div>
            {answerState.status !== "pending" ? (
              <div className="mt-3 space-y-1 text-sm leading-6">
                <p>Réponse saisie: {answerState.answer || "Aucune"}</p>
                <p>Réponse attendue: {answerState.expected}</p>
                <p>Similarité: {answerState.similarity}%</p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6">
                Tu peux répondre maintenant ou la marquer comme passée pour y revenir
                plus tard.
              </p>
            )}
          </div>

          <div className="flex items-stretch gap-3">
            <button
              type="button"
              onClick={onPrevious}
              className="flex items-center gap-2 rounded-[1.4rem] border border-[rgba(22,50,41,0.12)] bg-white/80 px-4 py-3 text-sm font-semibold text-[#163229] transition hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
              Préc.
            </button>
            <button
              type="button"
              onClick={onNext}
              className="flex items-center gap-2 rounded-[1.4rem] border border-[rgba(22,50,41,0.12)] bg-white/80 px-4 py-3 text-sm font-semibold text-[#163229] transition hover:bg-white"
            >
              Suiv.
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <aside className="glass-panel shell-border rounded-[2rem] p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.22em] text-[rgba(22,50,41,0.46)]">
          Navigation compacte
        </p>
        <h3 className="section-title mt-2 text-3xl font-semibold">
          Reviens sur n’importe quelle question.
        </h3>
        <div className="mt-6 grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-4">
          {answers.map((answer, index) => (
            <button
              key={`${items[index].id}-${index}`}
              type="button"
              onClick={() => onSelectQuestion(index)}
              className={`aspect-square rounded-2xl border text-sm font-semibold transition ${
                index === currentIndex
                  ? "border-[#163229] bg-[#163229] text-white"
                  : getStatusClasses(answer.status)
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}


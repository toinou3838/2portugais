"use client";

import { QuizAnswerState, QuizSummaryStats } from "@/lib/types";

type QuizProgressProps = {
  currentIndex: number;
  answers: QuizAnswerState[];
  summary: QuizSummaryStats;
};

export function QuizProgress({
  currentIndex,
  answers,
  summary,
}: QuizProgressProps) {
  const progress =
    answers.length > 0
      ? Math.round(
          (answers.filter((item) => item.status !== "pending").length / answers.length) *
            100,
        )
      : 0;

  return (
    <div className="shell-border rounded-[1.6rem] bg-white/85 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[rgba(22,50,41,0.48)]">
            Progression
          </p>
          <h3 className="mt-2 text-2xl font-semibold">
            Question {currentIndex + 1} / {answers.length}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="status-pill bg-[rgba(22,50,41,0.08)] text-[#163229]">
            Score {summary.correct}/{summary.total}
          </span>
          <span className="status-pill bg-[rgba(185,119,63,0.14)] text-[#9e6230]">
            Répondues {summary.answered}
          </span>
          <span className="status-pill bg-[rgba(200,109,79,0.12)] text-[#a8583f]">
            Passées {summary.skipped}
          </span>
        </div>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-[rgba(22,50,41,0.08)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#b9773f] to-[#163229] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}


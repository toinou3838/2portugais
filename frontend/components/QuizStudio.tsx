"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { startTransition, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  DifficultyLevel,
  ProgressPayload,
  QuizAnswerState,
  QuizFeedback,
  QuizGenerationResponse,
  QuizMode,
  UserProfile,
} from "@/lib/types";
import {
  buildEmptyAnswers,
  computeSummary,
  evaluateAnswer,
  flipQuizDirections,
} from "@/lib/quiz";
import { QuizRunner } from "@/components/QuizRunner";
import { QuizSetup } from "@/components/QuizSetup";
import { QuizSummary } from "@/components/QuizSummary";
import { TranslatorPanel } from "@/components/TranslatorPanel";
import { VocabularyAdminPanel } from "@/components/VocabularyAdminPanel";

const defaultConfig = {
  questionCount: 20,
  conjugationPercentage: 10,
  difficulty: 2 as DifficultyLevel,
};

function getTemplate() {
  return process.env.NEXT_PUBLIC_CLERK_TOKEN_TEMPLATE;
}

export function QuizStudio() {
  const { getToken } = useAuth();
  const { isSignedIn } = useUser();
  const [questionCount, setQuestionCount] = useState(defaultConfig.questionCount);
  const [conjugationPercentage, setConjugationPercentage] = useState(
    defaultConfig.conjugationPercentage,
  );
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(defaultConfig.difficulty);
  const [quiz, setQuiz] = useState<QuizGenerationResponse | null>(null);
  const [answers, setAnswers] = useState<QuizAnswerState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [syncingProgress, setSyncingProgress] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(
    "La progression sera synchronisée à la fin du quiz.",
  );
  const [syncedQuizId, setSyncedQuizId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transientFeedback, setTransientFeedback] = useState<QuizFeedback | null>(null);
  const [quizMode, setQuizMode] = useState<QuizMode>("standard");

  const summary = computeSummary(answers);
  const quizCompleted = answers.length > 0 && answers.every((item) => item.status !== "pending");

  useEffect(() => {
    const currentAnswer = answers[currentIndex];
    setDraftAnswer(currentAnswer?.answer ?? "");
  }, [answers, currentIndex]);

  useEffect(() => {
    if (!isSignedIn) {
      setProfile(null);
      return;
    }

    async function loadProfile() {
      try {
        const token = await getToken(getTemplate() ? { template: getTemplate() } : undefined);
        if (!token) {
          return;
        }
        const data = await apiFetch<UserProfile>("/me", { token });
        setProfile(data);
      } catch (error) {
        console.error(error);
      }
    }

    void loadProfile();
  }, [getToken, isSignedIn, syncedQuizId]);

  function publishProfile(data: UserProfile) {
    setProfile(data);
    window.dispatchEvent(new CustomEvent("profile-updated", { detail: data }));
  }

  async function syncAnsweredProgress(
    correctIncrement: number,
    masteryUpdate: ProgressPayload["mastery_update"] = null,
  ) {
    if (!isSignedIn) {
      return;
    }

    const token = await getToken(getTemplate() ? { template: getTemplate() } : undefined);
    if (!token) {
      return;
    }

    const data = await apiFetch<UserProfile>("/progress", {
      method: "POST",
      token,
      body: JSON.stringify({
        quiz_id: quiz?.quiz_id ?? `live-${Date.now()}`,
        answered_questions: 1,
        correct_answers: correctIncrement,
        quizzes_completed: 0,
        mastery_update: masteryUpdate,
      }),
    });

    publishProfile(data);
  }

  useEffect(() => {
    if (
      !quizCompleted ||
      !isSignedIn ||
      !quiz ||
      syncingProgress ||
      syncedQuizId === quiz.quiz_id
    ) {
      return;
    }

    const activeQuiz = quiz;

    async function syncProgress() {
      try {
        const token = await getToken(getTemplate() ? { template: getTemplate() } : undefined);
        if (!token) {
          return;
        }

        setSyncingProgress(true);
        const payload: ProgressPayload = {
          quiz_id: activeQuiz.quiz_id,
          answered_questions: 0,
          correct_answers: 0,
          quizzes_completed: 1,
        };

        const data = await apiFetch<UserProfile>("/progress", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });

        publishProfile(data);
        setSyncMessage("Progression quotidienne synchronisée.");
        setSyncedQuizId(activeQuiz.quiz_id);
      } catch (error) {
        setSyncMessage(
          error instanceof Error
            ? error.message
            : "Synchronisation de progression impossible.",
        );
      } finally {
        setSyncingProgress(false);
      }
    }

    void syncProgress();
  }, [
    getToken,
    isSignedIn,
    quiz,
    quizCompleted,
    summary.answered,
    summary.correct,
    syncedQuizId,
    syncingProgress,
  ]);

  async function generateQuiz(mode: QuizMode) {
    setLoadingQuiz(true);
    setSetupMessage(null);
    setSyncMessage("La progression sera synchronisée à la fin du quiz.");

    try {
      const token = isSignedIn
        ? await getToken(getTemplate() ? { template: getTemplate() } : undefined)
        : null;
      const data = await apiFetch<QuizGenerationResponse>("/quiz/generate", {
        method: "POST",
        token,
        body: JSON.stringify({
          question_count: questionCount,
          conjugation_percentage: conjugationPercentage,
          difficulty,
          mode,
        }),
      });

      startTransition(() => {
        setQuiz(data);
        setAnswers(buildEmptyAnswers(data.items));
        setCurrentIndex(0);
        setDraftAnswer("");
        setSyncedQuizId(null);
        setTransientFeedback(null);
        setQuizMode(mode);
      });
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : "Quiz indisponible.");
    } finally {
      setLoadingQuiz(false);
    }
  }

  function updateAnswer(index: number, next: QuizAnswerState) {
    setAnswers((current) =>
      current.map((answer, answerIndex) => (answerIndex === index ? next : answer)),
    );
  }

  function moveTo(index: number) {
    if (!quiz) {
      return;
    }
    setTransientFeedback(null);
    setCurrentIndex(Math.max(0, Math.min(index, quiz.items.length - 1)));
  }

  function handleValidate() {
    if (!quiz) {
      return;
    }

    const currentItem = quiz.items[currentIndex];
    const evaluated = evaluateAnswer(currentItem, draftAnswer);
    const feedbackStatus = evaluated.status === "correct" ? "correct" : "incorrect";
    updateAnswer(currentIndex, evaluated);
    setTransientFeedback({
      questionIndex: currentIndex,
      answer: draftAnswer,
      expected: evaluated.expected,
      status: feedbackStatus,
    });
    void syncAnsweredProgress(
      feedbackStatus === "correct" ? 1 : 0,
      feedbackStatus === "correct"
        ? {
            item_id: currentItem.id,
            source: currentItem.source,
            direction: currentItem.dir,
            correct: true,
          }
        : null,
    );

    if (currentIndex < quiz.items.length - 1) {
      setCurrentIndex((value) => value + 1);
      setDraftAnswer("");
    }
  }

  function handleSkip() {
    if (!quiz) {
      return;
    }

    const skippedState: QuizAnswerState = {
      answer: draftAnswer,
      expected: quiz.items[currentIndex].dir === 0 ? quiz.items[currentIndex].pt : quiz.items[currentIndex].fr,
      similarity: 0,
      status: "skipped",
    };
    updateAnswer(currentIndex, skippedState);
    setTransientFeedback({
      questionIndex: currentIndex,
      answer: draftAnswer,
      expected: skippedState.expected,
      status: "skipped",
    });

    if (currentIndex < quiz.items.length - 1) {
      setCurrentIndex((value) => value + 1);
      setDraftAnswer("");
    }
  }

  function handleFlipDirections() {
    if (!quiz) {
      return;
    }

    const nextQuiz: QuizGenerationResponse = {
      ...quiz,
      quiz_id: `${quiz.quiz_id}-flip-${Date.now()}`,
      generated_at: new Date().toISOString(),
      items: flipQuizDirections(quiz.items),
    };

    setQuiz(nextQuiz);
    setAnswers(buildEmptyAnswers(nextQuiz.items));
    setCurrentIndex(0);
    setDraftAnswer("");
    setSyncedQuizId(null);
    setTransientFeedback(null);
    setSyncMessage("Quiz inversé. Nouvelle tentative prête.");
  }

  const todayProgressLabel = profile
    ? `Aujourd’hui : ${profile.today_progress.answered_questions}/${profile.goal} questions`
    : null;

  return (
    <div className="grid gap-6">
      <QuizSetup
        questionCount={questionCount}
        conjugationPercentage={conjugationPercentage}
        difficulty={difficulty}
        loading={loadingQuiz}
        canGenerateReview={Boolean(isSignedIn)}
        message={setupMessage}
        onQuestionCountChange={setQuestionCount}
        onConjugationPercentageChange={setConjugationPercentage}
        onDifficultyChange={setDifficulty}
        onGenerateStandard={() => void generateQuiz("standard")}
        onGenerateReview={() => void generateQuiz("review")}
      />

      {todayProgressLabel ? (
        <div className="inline-flex w-fit rounded-full bg-[rgba(185,119,63,0.14)] px-4 py-2 text-sm font-semibold text-[#9e6230]">
          {todayProgressLabel}
        </div>
      ) : null}

      {quiz && answers.length > 0 ? (
        quizCompleted ? (
          <QuizSummary
            summary={summary}
            quiz={quiz}
            lastFeedback={transientFeedback}
            saving={syncingProgress}
            syncMessage={syncMessage}
            onFlipDirections={handleFlipDirections}
            onNewQuiz={() => void generateQuiz(quizMode)}
          />
        ) : (
          <QuizRunner
            items={quiz.items}
            answers={answers}
            currentIndex={currentIndex}
            draftAnswer={draftAnswer}
            summary={summary}
            transientFeedback={transientFeedback}
            todayProgressLabel={todayProgressLabel}
            onDraftAnswerChange={setDraftAnswer}
            onValidate={handleValidate}
            onSkip={handleSkip}
            onSelectQuestion={moveTo}
            onPrevious={() => moveTo(currentIndex - 1)}
            onNext={() => moveTo(currentIndex + 1)}
          />
        )
      ) : (
        <section className="glass-panel shell-border rounded-[2rem] p-8 shadow-soft">
          <p className="text-sm uppercase tracking-[0.22em] text-[rgba(22,50,41,0.48)]">
            Espace quiz
          </p>
          <h2 className="section-title mt-2 text-4xl font-semibold">
            Aucun quiz actif pour le moment.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[rgba(22,50,41,0.68)]">
            Lance une première série pour mélanger la conjugaison locale et le
            vocabulaire persistant. Les résultats seront synchronisés avec ton profil
            si tu es connecté.
          </p>
        </section>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <TranslatorPanel />
        <VocabularyAdminPanel />
      </div>
    </div>
  );
}

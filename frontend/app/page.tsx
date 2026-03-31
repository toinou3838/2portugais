import { Sparkles } from "lucide-react";
import { HeaderTitle } from "@/components/HeaderTitle";
import { ProfileButton } from "@/components/ProfileButton";
import { QuizStudio } from "@/components/QuizStudio";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="glass-panel shell-border animate-float-in sticky top-4 z-30 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] px-5 py-4 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="mesh-glow relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#163229] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <HeaderTitle />
          </div>
          <ProfileButton />
        </header>

        <QuizStudio />
      </div>
    </main>
  );
}

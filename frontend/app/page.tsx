import { Flame, Languages, NotebookTabs, Sparkles } from "lucide-react";
import { ProfileButton } from "@/components/ProfileButton";
import { QuizStudio } from "@/components/QuizStudio";

const highlights = [
  {
    icon: Languages,
    title: "Deux sens de traduction",
    description: "Français vers portugais et portugais vers français dans le même espace.",
  },
  {
    icon: NotebookTabs,
    title: "Conjugaison + vocabulaire",
    description: "Quiz hybrides avec pondération fine et compensation automatique.",
  },
  {
    icon: Flame,
    title: "Streaks quotidiens",
    description: "Objectif 50 questions, rappels email et suivi natif du profil.",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="glass-panel shell-border animate-float-in sticky top-4 z-30 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] px-5 py-4 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="mesh-glow relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#163229] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-[rgba(22,50,41,0.52)]">
                O Mestre do Português
              </p>
              <h1 className="section-title text-3xl font-semibold sm:text-4xl">
                Maîtriser le portugais avec une interface enfin propre.
              </h1>
            </div>
          </div>
          <ProfileButton />
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-panel-strong shell-border animate-float-in rounded-[2.2rem] p-6 shadow-card sm:p-8">
            <p className="mb-4 inline-flex rounded-full bg-[rgba(185,119,63,0.14)] px-4 py-2 text-sm font-semibold text-[#9e6230]">
              Quiz premium, auth Clerk native, backend FastAPI séparé
            </p>
            <div className="max-w-3xl">
              <h2 className="section-title text-5xl font-semibold leading-none sm:text-6xl">
                Le nouveau cockpit pour réviser vocabulaire et conjugaison.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[rgba(22,50,41,0.74)] sm:text-lg">
                Génère des séries mixtes, corrige avec tolérance fuzzy, pilote ton
                streak quotidien et enrichis ta base de vocabulaire depuis une
                interface pensée comme un vrai produit web.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {highlights.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="shell-border rounded-[1.6rem] bg-white/80 p-5 shadow-soft"
                >
                  <div className="mb-4 inline-flex rounded-2xl bg-[rgba(22,50,41,0.08)] p-3 text-[#163229]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[rgba(22,50,41,0.68)]">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="shell-border rounded-[2rem] bg-[#163229] p-6 text-white shadow-card">
              <p className="text-sm uppercase tracking-[0.2em] text-white/60">
                Expérience
              </p>
              <h3 className="section-title mt-2 text-4xl font-semibold">
                Auth propre, design sobre, rythme quotidien.
              </h3>
              <p className="mt-4 text-sm leading-6 text-white/76">
                Clerk gère Google et email, ton backend valide les tokens, et le
                profil applicatif se construit automatiquement à la première session.
              </p>
            </div>
            <div className="shell-border rounded-[2rem] bg-[rgba(255,250,242,0.82)] p-6 shadow-soft">
              <p className="text-sm uppercase tracking-[0.2em] text-[rgba(22,50,41,0.52)]">
                Objectif quotidien
              </p>
              <div className="mt-4 flex items-end gap-3">
                <span className="section-title text-6xl font-semibold">50</span>
                <span className="pb-2 text-base text-[rgba(22,50,41,0.68)]">
                  questions pour prolonger la flamme
                </span>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[rgba(22,50,41,0.08)]">
                <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-[#b9773f] to-[#163229]" />
              </div>
            </div>
          </div>
        </section>

        <QuizStudio />
      </div>
    </main>
  );
}


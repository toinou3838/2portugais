"use client";

import { SignOutButton, UserButton, useUser } from "@clerk/nextjs";
import { Bell, Flame, Mail, Trophy } from "lucide-react";
import { UserProfile } from "@/lib/types";

type ProfilePanelProps = {
  profile: UserProfile | null;
  loading: boolean;
  onToggleReminder: (value: boolean) => void;
};

export function ProfilePanel({
  profile,
  loading,
  onToggleReminder,
}: ProfilePanelProps) {
  const { user } = useUser();

  return (
    <div className="glass-panel-strong shell-border absolute right-0 top-[calc(100%+0.85rem)] z-40 w-[min(22rem,calc(100vw-2rem))] rounded-[1.8rem] p-5 shadow-card">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-2xl bg-[rgba(22,50,41,0.1)]">
          {user?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.imageUrl}
              alt={user.fullName ?? "Utilisateur"}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">
            {profile?.display_name ?? user?.fullName ?? "Compte Clerk"}
          </p>
          <p className="truncate text-sm text-[rgba(22,50,41,0.6)]">
            {profile?.email ?? user?.primaryEmailAddress?.emailAddress ?? "Email"}
          </p>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.4rem] border border-[rgba(22,50,41,0.08)] bg-white p-4">
          <div className="flex items-center gap-2 text-[#163229]">
            <Flame className="h-4 w-4" />
            <span className="text-sm font-semibold">Streak</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">
            {loading ? "..." : profile?.current_streak ?? 0}
          </p>
        </div>
        <div className="rounded-[1.4rem] border border-[rgba(22,50,41,0.08)] bg-white p-4">
          <div className="flex items-center gap-2 text-[#163229]">
            <Trophy className="h-4 w-4" />
            <span className="text-sm font-semibold">Aujourd’hui</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">
            {loading ? "..." : profile?.today_progress.answered_questions ?? 0}
          </p>
        </div>
      </div>

      <label className="mt-5 flex items-center justify-between rounded-[1.4rem] border border-[rgba(22,50,41,0.08)] bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[rgba(185,119,63,0.14)] p-2 text-[#9e6230]">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold">Rappels email</p>
            <p className="text-sm text-[rgba(22,50,41,0.6)]">
              Envoi si les 50 questions ne sont pas atteintes.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggleReminder(!(profile?.reminder_opt_in ?? false))}
          className={`relative h-8 w-14 rounded-full transition ${
            profile?.reminder_opt_in ? "bg-[#163229]" : "bg-[rgba(22,50,41,0.18)]"
          }`}
          aria-pressed={profile?.reminder_opt_in ?? false}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
              profile?.reminder_opt_in ? "left-7" : "left-1"
            }`}
          />
        </button>
      </label>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[rgba(22,50,41,0.58)]">
          <Mail className="h-4 w-4" />
          Reste {profile?.questions_remaining_today ?? 50} questions aujourd’hui
        </div>
        <SignOutButton>
          <button
            type="button"
            className="rounded-full border border-[rgba(22,50,41,0.12)] bg-white px-4 py-2 text-sm font-semibold text-[#163229] transition hover:bg-[#f8f3eb]"
          >
            Déconnexion
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}


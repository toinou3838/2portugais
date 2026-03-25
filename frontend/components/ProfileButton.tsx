"use client";

import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";
import { Flame, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { UserProfile } from "@/lib/types";
import { ProfilePanel } from "@/components/ProfilePanel";

function getTemplate() {
  return process.env.NEXT_PUBLIC_CLERK_TOKEN_TEMPLATE;
}

export function ProfileButton() {
  const { getToken, isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setProfile(null);
      setOpen(false);
      return;
    }

    async function loadProfile() {
      setLoading(true);
      try {
        const token = await getToken(
          getTemplate() ? { template: getTemplate() } : undefined,
        );
        if (!token) {
          return;
        }
        const data = await apiFetch<UserProfile>("/me", { token });
        setProfile(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [getToken, isSignedIn]);

  async function handleToggleReminder(value: boolean) {
    const token = await getToken(getTemplate() ? { template: getTemplate() } : undefined);
    if (!token) {
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            reminder_opt_in: value,
          }
        : current,
    );

    try {
      const data = await apiFetch<UserProfile>("/preferences/reminders", {
        method: "POST",
        token,
        body: JSON.stringify({ reminder_opt_in: value }),
      });
      setProfile(data);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div ref={ref} className="relative">
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="rounded-full bg-[#163229] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#21453a]"
          >
            Se connecter
          </button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-3 rounded-full border border-[rgba(22,50,41,0.12)] bg-white/82 px-4 py-2.5 text-left shadow-soft transition hover:bg-white"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(22,50,41,0.08)] text-[#163229]">
            <UserRound className="h-5 w-5" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-semibold text-[#163229]">
              {profile?.display_name ?? "Mon profil"}
            </span>
            <span className="flex items-center gap-1 text-xs text-[rgba(22,50,41,0.58)]">
              <Flame className="h-3.5 w-3.5" />
              {profile?.current_streak ?? 0} jours
            </span>
          </span>
        </button>

        {open ? (
          <ProfilePanel
            profile={profile}
            loading={loading}
            onToggleReminder={handleToggleReminder}
          />
        ) : null}
      </SignedIn>
    </div>
  );
}


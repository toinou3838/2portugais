"use client";

import { useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";

export function HeaderTitle() {
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <>
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-[rgba(22,50,41,0.52)]">
          O Mestre do Portu
          <button
            type="button"
            onClick={() => setAdminOpen(true)}
            className="mx-[0.03em] inline-flex items-center border-b border-[rgba(22,50,41,0.35)] font-semibold text-[#163229] transition hover:border-[#163229]"
            title="Ouvrir le panneau admin"
          >
            g
          </button>
          uês
        </p>
        <h1 className="section-title text-3xl font-semibold sm:text-4xl">
          Perfectionne ton portugais avec des quizzs personnalisés.
        </h1>
      </div>

      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
    </>
  );
}


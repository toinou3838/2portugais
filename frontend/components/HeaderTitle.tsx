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
            className="inline cursor-pointer p-0 transition hover:opacity-100"
            title="Ouvrir le panneau admin"
            aria-label="Ouvrir le panneau admin"
            style={{ font: "inherit", letterSpacing: "inherit", color: "inherit" }}
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

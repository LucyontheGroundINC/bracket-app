"use client";

import { useState } from "react";
import toast from "react-hot-toast";

function getErrorMessage(e: unknown, fallback = "Recalc failed") {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}

export default function RecalcButton({ tournamentId }: { tournamentId: number }) {
  const [busy, setBusy] = useState(false);

  async function recalc() {
    const toastId = toast.loading("Recalculating…");

    try {
      setBusy(true);

      const res = await fetch("/api/scores/recalc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error ?? "Recalc failed");
      }

      toast.success("Scores updated", { id: toastId });

      // simple refresh
      window.location.reload();
    } catch (e: unknown) {
      console.error("[RecalcButton] error:", e);
      toast.error(getErrorMessage(e), { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={recalc}
      disabled={busy}
      className="rounded bg-blue-600 text-white px-3 py-2 text-sm disabled:opacity-60"
    >
      {busy ? "Recalculating…" : "Recalculate"}
    </button>
  );
}


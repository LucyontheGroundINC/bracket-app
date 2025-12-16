"use client";
import { useState } from "react";
import toast from "react-hot-toast";

export default function RecalcButton({ tournamentId }: { tournamentId: number }) {
  const [busy, setBusy] = useState(false);

  async function recalc() {
    try {
      setBusy(true);
      const t = toast.loading("Recalculating…");
      const res = await fetch("/api/scores/recalc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Recalc failed");
      toast.success("Scores updated", { id: t });
      // simple refresh
      location.reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Recalc failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={recalc}
      disabled={busy}
      className="rounded bg-blue-600 text-white px-3 py-2 text-sm disabled:opacity-60"
    >
      {busy ? "Recalculating…" : "Recalculate"}
    </button>
  );
}

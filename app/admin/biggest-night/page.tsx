"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "lucyonthegroundwithrocks@gmail.com";

type SeasonRow = {
  id: string;
  name: string;
  year: number | null;
  is_active: boolean;
  lock_at: string | null;
  tie_breaker_seconds: number | null;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
};

type NomineeRow = {
  id: string;
  category_id: string;
  name: string;
  subtitle: string | null;
  weight_points: number;
  is_winner: boolean;
  sort_order: number;
};

export default function BiggestNightAdminPage() {
  const [email, setEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [season, setSeason] = useState<SeasonRow | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [nominees, setNominees] = useState<NomineeRow[]>([]);

  // Lock time editor
  const [lockAtInput, setLockAtInput] = useState<string>("");
  const [tieBreakerSecondsInput, setTieBreakerSecondsInput] = useState<string>("");

  const isAdmin = email === ADMIN_EMAIL;

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  // -------- load auth email --------
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    };
    run();
  }, []);

  // -------- load data --------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // Active season
        const { data: s, error: sErr } = await supabase
          .from("biggest_night_seasons")
          .select("id, name, year, is_active, lock_at, tie_breaker_seconds")
          .eq("is_active", true)
          .maybeSingle();

        if (sErr) throw new Error(sErr.message);
        if (!s) throw new Error("No active Biggest Night season found.");

        const seasonRow = s as SeasonRow;
        setSeason(seasonRow);

        // For the datetime-local input
        if (seasonRow.lock_at) {
          // Convert to yyyy-MM-ddTHH:mm (local)
          const d = new Date(seasonRow.lock_at);
          const pad = (n: number) => String(n).padStart(2, "0");
          const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
            d.getHours()
          )}:${pad(d.getMinutes())}`;
          setLockAtInput(local);
        } else {
          setLockAtInput("");
        }

        if (seasonRow.tie_breaker_seconds !== null && seasonRow.tie_breaker_seconds !== undefined) {
          setTieBreakerSecondsInput(String(seasonRow.tie_breaker_seconds));
        } else {
          setTieBreakerSecondsInput("");
        }

        // Categories
        const { data: c, error: cErr } = await supabase
          .from("biggest_night_categories")
          .select("id, name, sort_order")
          .eq("season_id", seasonRow.id)
          .order("sort_order", { ascending: true });

        if (cErr) throw new Error(cErr.message);
 const catRows = (c ?? []) as CategoryRow[];
setCategories(catRows);

const catIds = catRows.map((x) => String(x.id));


        if (catIds.length === 0) {
          setNominees([]);
          return;
        }

        // Nominees
        const { data: n, error: nErr } = await supabase
          .from("biggest_night_nominees")
          .select("id, category_id, name, subtitle, weight_points, is_winner, sort_order")
          .in("category_id", catIds)
          .order("sort_order", { ascending: true });

        if (nErr) throw new Error(nErr.message);
        setNominees((n ?? []) as NomineeRow[]);
     } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  setError(msg || "Failed to load admin data.");
}
 finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const nomineesByCategory = useMemo(() => {
    const map = new Map<string, NomineeRow[]>();
    for (const n of nominees) {
      const key = String(n.category_id);
      const list = map.get(key) ?? [];
      list.push(n);
      map.set(key, list);
    }
    return map;
  }, [nominees]);

  async function refreshNominees() {
    if (!season) return;
    try {
      const catIds = categories.map((c) => c.id);
      const { data: n, error: nErr } = await supabase
        .from("biggest_night_nominees")
        .select("id, category_id, name, subtitle, weight_points, is_winner, sort_order")
        .in("category_id", catIds)
        .order("sort_order", { ascending: true });

      if (nErr) throw new Error(nErr.message);
      setNominees((n ?? []) as NomineeRow[]);
   } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  setError(msg || "Failed to Refresh nominees.");
}

  }

  // -------- actions --------

  // Set exactly one winner per category:
  // 1) set all nominees in category is_winner=false
  // 2) set selected nominee is_winner=true
  async function setWinner(categoryId: string, nomineeId: string) {
    setError(null);
    setSaving(`winner:${categoryId}`);

    try {
      // Clear category winners
      const { error: clearErr } = await supabase
        .from("biggest_night_nominees")
        .update({ is_winner: false })
        .eq("category_id", categoryId);

      if (clearErr) throw new Error(clearErr.message);

      // Set selected winner
      const { error: setErr } = await supabase
        .from("biggest_night_nominees")
        .update({ is_winner: true })
        .eq("id", nomineeId);

      if (setErr) throw new Error(setErr.message);

      showToast("Winner saved ✓");
      await refreshNominees();
    } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  setError(msg || "Failed to Set winner.");
}
 finally {
      setSaving(null);
    }
  }

  async function updateWeight(nomineeId: string, weight: number) {
    setError(null);
    setSaving(`weight:${nomineeId}`);

    try {
      const { error: upErr } = await supabase
        .from("biggest_night_nominees")
        .update({ weight_points: weight })
        .eq("id", nomineeId);

      if (upErr) throw new Error(upErr.message);

      showToast("Weight saved ✓");
      await refreshNominees();
   } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  setError(msg || "Failed to update weight.");
}
 finally {
      setSaving(null);
    }
  }

  async function saveLockTime() {
    if (!season) return;

    setError(null);
    setSaving("lock");

    try {
      // lockAtInput is a "datetime-local" string (local time)
      // Convert to ISO by letting Date parse it as local time.
      const lockAtIso = lockAtInput ? new Date(lockAtInput).toISOString() : null;

      const { error: lockErr } = await supabase
        .from("biggest_night_seasons")
        .update({ lock_at: lockAtIso })
        .eq("id", season.id);

      if (lockErr) throw new Error(lockErr.message);

      showToast("Lock time saved ✓");
      setSeason((prev) => (prev ? { ...prev, lock_at: lockAtIso } : prev));
    } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  setError(msg || "Failed to save lock time.");
}
finally {
      setSaving(null);
    }
  }

  async function saveTieBreakerSeconds() {
    if (!season) return;

    setError(null);
    setSaving("tie-breaker");

    try {
      const parsed = tieBreakerSecondsInput.trim() === ""
        ? null
        : Math.max(0, Math.floor(Number(tieBreakerSecondsInput)));

      const { error: tieErr } = await supabase
        .from("biggest_night_seasons")
        .update({ tie_breaker_seconds: parsed })
        .eq("id", season.id);

      if (tieErr) throw new Error(tieErr.message);

      showToast("Tie-breaker saved ✓");
      setSeason((prev) => (prev ? { ...prev, tie_breaker_seconds: parsed } : prev));
      if (parsed === null) setTieBreakerSecondsInput("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Failed to save tie-breaker seconds.");
    } finally {
      setSaving(null);
    }
  }

  if (!email) {
    // auth still loading
    return (
      <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] pt-24 px-4">
        <div className="max-w-4xl mx-auto text-sm text-[#0A2041]/70">
          Loading…
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] pt-24 px-4">
        <main className="max-w-2xl mx-auto">
          <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-6 shadow-sm">
            <h1 className="text-xl font-black text-[#CA4C4C]">Admin only</h1>
            <p className="mt-2 text-sm text-[#0A2041]/70">
              You’re signed in as <span className="font-semibold">{email}</span>, but this page is restricted.
            </p>
            <div className="mt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-black bg-[#0A2041] text-[#F8F5EE]"
              >
                Back to Dashboard →
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] pt-24 pb-10 px-4">
      <main className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0A2041]">
              Biggest Night Admin
            </h1>
            <p className="text-sm text-[#0A2041]/70 mt-1">
              Set lock time, edit weights, and mark winners.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/biggest-night/ballot"
              className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-black bg-[#0A2041] text-[#F8F5EE] hover:opacity-95"
            >
              View Ballot →
            </Link>
            <Link
              href="/biggest-night/leaderboard"
              className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-black bg-[#FEE689] text-[#0A2041] hover:opacity-95 border border-[#0A2041]/10"
            >
              View Leaderboard →
            </Link>
          </div>
        </section>

        {/* Status */}
        {loading ? (
          <div className="text-sm text-[#0A2041]/70">Loading admin data…</div>
        ) : null}

        {error ? (
          <div className="text-sm text-[#CA4C4C] bg-white/80 border border-[#F5B8B0] rounded-xl px-4 py-3">
            {error}
          </div>
        ) : null}

        {toast ? (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#FEE689] text-[#0A2041] px-5 py-3 text-sm font-black shadow-lg border border-[#0A2041]/10">
            {toast}
          </div>
        ) : null}

        {/* Lock Time */}
        <section className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-black text-[#CA4C4C] mb-2">Ballot lock time</h2>
          <p className="text-xs text-[#0A2041]/70 mb-3">
            After lock time, users can’t change picks.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#0A2041]/70 mb-1">
                Lock at (local time)
              </label>
              <input
                type="datetime-local"
                value={lockAtInput}
                onChange={(e) => setLockAtInput(e.target.value)}
                className="w-full rounded-xl border border-[#0A2041]/10 px-3 py-2 bg-white"
              />
            </div>

            <button
              type="button"
              onClick={saveLockTime}
              disabled={saving === "lock"}
              className="rounded-xl bg-[#0A2041] text-[#F8F5EE] px-4 py-3 text-sm font-black hover:opacity-95 disabled:opacity-60"
            >
              {saving === "lock" ? "Saving…" : "Save lock time"}
            </button>

            <button
              type="button"
              onClick={() => setLockAtInput("")}
              className="rounded-xl bg-white border border-[#0A2041]/10 px-4 py-3 text-sm font-black hover:bg-white/90"
            >
              Clear
            </button>
          </div>
        </section>

        {/* Tie-breaker */}
        <section className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-black text-[#CA4C4C] mb-2">Tie-breaker answer</h2>
          <p className="text-xs text-[#0A2041]/70 mb-3">
            Set the official seconds for the Best Actress acceptance speech.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-[#0A2041]/70 mb-1">
                Actual seconds (closest without going over wins ties)
              </label>
              <input
                type="number"
                min={0}
                value={tieBreakerSecondsInput}
                onChange={(e) => setTieBreakerSecondsInput(e.target.value)}
                className="w-full rounded-xl border border-[#0A2041]/10 px-3 py-2 bg-white"
                placeholder="e.g. 74"
              />
            </div>

            <button
              type="button"
              onClick={saveTieBreakerSeconds}
              disabled={saving === "tie-breaker"}
              className="rounded-xl bg-[#0A2041] text-[#F8F5EE] px-4 py-3 text-sm font-black hover:opacity-95 disabled:opacity-60"
            >
              {saving === "tie-breaker" ? "Saving…" : "Save tie-breaker"}
            </button>

            <button
              type="button"
              onClick={() => setTieBreakerSecondsInput("")}
              className="rounded-xl bg-white border border-[#0A2041]/10 px-4 py-3 text-sm font-black hover:bg-white/90"
            >
              Clear
            </button>
          </div>
        </section>

        {/* Categories */}
        <section className="space-y-4">
          {categories.map((cat) => {
            const list = nomineesByCategory.get(cat.id) ?? [];
            const currentWinner = list.find((n) => n.is_winner);

            return (
              <div
                key={cat.id}
                className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-lg font-black text-[#0A2041]">{cat.name}</h3>
                    <p className="text-xs text-[#0A2041]/65 mt-1">
                      Winner:{" "}
                      <span className="font-semibold">
                        {currentWinner ? currentWinner.name : "Not set"}
                      </span>
                    </p>
                  </div>

                  <div className="text-xs text-[#0A2041]/60">
                    {saving === `winner:${cat.id}` ? "Saving winner…" : ""}
                  </div>
                </div>

                {list.length === 0 ? (
                  <div className="text-sm text-[#0A2041]/70">
                    No nominees in this category yet.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {list.map((n) => (
                      <div
                        key={n.id}
                        className={[
                          "rounded-2xl border p-4 bg-white",
                          n.is_winner
                            ? "border-[#CA4C4C] bg-[#FEE689]/25"
                            : "border-[#0A2041]/10",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setWinner(cat.id, n.id)}
                            className="min-w-0 text-left"
                          >
                            <div className="font-extrabold truncate">
                              {n.name}
                              {n.is_winner ? (
                                <span className="ml-2 text-[10px] font-black px-2 py-1 rounded-full bg-[#CA4C4C] text-[#F8F5EE]">
                                  WINNER
                                </span>
                              ) : null}
                            </div>
                            {n.subtitle ? (
                              <div className="text-xs text-[#0A2041]/65 truncate mt-1">
                                {n.subtitle}
                              </div>
                            ) : null}
                          </button>

                          <div className="shrink-0 flex items-center gap-2">
                            <label className="text-[10px] font-black text-[#0A2041]/60">
                              PTS
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={n.weight_points}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setNominees((prev) =>
                                  prev.map((x) =>
                                    x.id === n.id ? { ...x, weight_points: val } : x
                                  )
                                );
                              }}
                              onBlur={(e) => {
                                const val = Number(e.target.value) || 0;
                                updateWeight(n.id, val);
                              }}
                              className="w-20 rounded-lg border border-[#0A2041]/10 px-2 py-1 text-sm font-bold"
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setWinner(cat.id, n.id)}
                            className="text-xs font-black text-[#CA4C4C] hover:underline"
                          >
                            Set as winner
                          </button>

                          <span className="text-[11px] text-[#0A2041]/55">
                            {saving === `weight:${n.id}` ? "Saving…" : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}

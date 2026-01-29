"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

type BallotNominee = {
  id: string;
  category_id: string;
  name: string;
  subtitle: string | null;
  image_url: string | null;
  sort_order: number;
};

type BallotCategory = {
  id: string;
  name: string;
  sortOrder: number;
  nominees: BallotNominee[];
};

type BallotSeason = {
  id: string;
  name: string;
  year: number | null;
  lockAt: string | null;
  isActive: boolean;
};

type BallotResponse = {
  season: BallotSeason | null;
  categories: BallotCategory[];
};

type PickRow = {
  category_id: string | number;
  nominee_id: string | number;
};

export default function BiggestNightBallotPage() {
  const router = useRouter();

  // Auth gate (RequireAuth already does this globally, but this page stays safe standalone too)
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [season, setSeason] = useState<BallotSeason | null>(null);
  const [categories, setCategories] = useState<BallotCategory[]>([]);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // categoryId -> nomineeId
  const [selected, setSelected] = useState<Record<string, string>>({});

  // saving state
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    tone: "success" | "error" | "info";
  }>({ show: false, message: "", tone: "success" });

  function showToast(message: string, tone: "success" | "error" | "info" = "success") {
    setToast({ show: true, message, tone });
    window.setTimeout(() => setToast((t) => ({ ...t, show: false })), 1200);
  }

  const isLocked = useMemo(() => {
    if (!season?.lockAt) return false;
    return Date.now() >= new Date(season.lockAt).getTime();
  }, [season?.lockAt]);

  const totalCategories = categories.length;

  const pickedCount = useMemo(() => {
    let count = 0;
    for (const c of categories) if (selected[c.id]) count += 1;
    return count;
  }, [categories, selected]);

  // -------- initial load: auth + ballot + my picks --------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) Ensure authed (localStorage-based)
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw new Error(authErr.message);

        const userId = authData.user?.id ?? null;

        if (!userId) {
          router.replace(`/sign-in?returnTo=${encodeURIComponent("/biggest-night/ballot")}`);
          return;
        }

        setCurrentUserId(userId);
        setAuthChecked(true);

        // 2) Load ballot structure (public API is fine)
        const ballotRes = await fetch("/api/biggest-night/ballot", { cache: "no-store" });
        if (!ballotRes.ok) {
          const j = await ballotRes.json().catch(() => null);
          throw new Error((j as { error?: string } | null)?.error ?? "Failed to load ballot.");
        }

        const ballotJson = (await ballotRes.json()) as BallotResponse;
        setSeason(ballotJson.season ?? null);
        setCategories(ballotJson.categories ?? []);

        if (ballotJson.categories?.length) {
          setExpandedCategoryId(ballotJson.categories[0].id);
        }

        // 3) Load my picks DIRECTLY from Supabase (no cookie-auth API)
        if (ballotJson.season?.id) {
          const { data: picks, error: picksErr } = await supabase
            .from("biggest_night_picks")
            .select("category_id, nominee_id")
            .eq("season_id", ballotJson.season.id)
            .eq("user_id", userId);

          if (picksErr) throw new Error(picksErr.message);

          const rows = (picks ?? []) as PickRow[];
          const map: Record<string, string> = {};

          for (const row of rows) {
            map[String(row.category_id)] = String(row.nominee_id);
          }

          setSelected(map);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Something went wrong loading the ballot.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  // -------- save pick: DIRECT Supabase upsert --------
  async function chooseNominee(categoryId: string, nomineeId: string) {
    if (!season?.id || !currentUserId) return;

    if (isLocked) {
      showToast("Ballot is locked.", "info");
      return;
    }

    // optimistic UI
    setSelected((prev) => ({ ...prev, [categoryId]: nomineeId }));
    setSavingCategoryId(categoryId);

    try {
      const { error: upErr } = await supabase
        .from("biggest_night_picks")
        .upsert(
          {
            season_id: season.id,
            category_id: categoryId,
            nominee_id: nomineeId,
            user_id: currentUserId,
          },
          { onConflict: "season_id,category_id,user_id" }
        );

      if (upErr) throw new Error(upErr.message);

      showToast("Saved ✓", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Failed to save pick.");
      showToast("Couldn’t save. Try again.", "error");
    } finally {
      setSavingCategoryId((cur) => (cur === categoryId ? null : cur));
    }
  }

  const headerSubtitle = season?.year ? `${season.name} (${season.year})` : season?.name ?? "";

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] flex items-center justify-center px-4">
        <div className="rounded-2xl bg-white/70 border border-[#0A2041]/10 px-4 py-3 text-sm text-[#0A2041]/70">
          Checking login…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041]">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-[#0A2041] text-[#F8F5EE] border-b border-white/10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg sm:text-xl font-black tracking-tight">Hollywood’s Biggest Night</div>
            <div className="text-xs text-white/75 truncate">{headerSubtitle}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-2">
              <span className="text-xs font-bold text-white/85">Progress</span>
              <span className="text-xs font-black text-[#FEE689]">
                {pickedCount}/{totalCategories || "—"}
              </span>
            </div>

            <div className="rounded-full px-3 py-2 text-xs font-black border bg-white/10 border-white/15 text-white/85">
              {isLocked ? "Locked" : savingCategoryId ? "Saving…" : "Auto-save"}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {/* Banner */}
        <div className="mb-6 rounded-3xl border border-[#0A2041]/10 bg-[#F8F5EE]/70 p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Make your picks for Hollywood’s Biggest Night
          </h1>
          <p className="mt-2 text-sm text-[#0A2041]/70">
            Tap a category, pick one nominee, and we’ll save automatically.
          </p>

          {season?.lockAt ? (
            <p className="mt-2 text-xs text-[#0A2041]/60">
              Ballot lock time:{" "}
              <span className="font-semibold">{new Date(season.lockAt).toLocaleString()}</span>
            </p>
          ) : null}

          {isLocked ? (
            <div className="mt-4 rounded-2xl bg-[#0A2041] text-[#F8F5EE] px-4 py-3 text-sm font-semibold">
              This ballot is locked. Picks can’t be changed right now.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl bg-white/80 border border-[#CA4C4C]/25 px-4 py-3 text-sm text-[#CA4C4C]">
              {error}
            </div>
          ) : null}
        </div>

        {/* Loading / empty states */}
        {loading ? (
          <div className="text-sm text-[#0A2041]/70">Loading ballot…</div>
        ) : !season ? (
          <div className="rounded-2xl bg-white/70 border border-[#0A2041]/10 p-6 text-sm text-[#0A2041]/70">
            No active season is set up yet.
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-2xl bg-white/70 border border-[#0A2041]/10 p-6 text-sm text-[#0A2041]/70">
            No categories yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {categories.map((cat) => {
              const isOpen = expandedCategoryId === cat.id;
              const pickedNomineeId = selected[cat.id] ?? null;

              const pickedNominee = pickedNomineeId
                ? cat.nominees.find((n) => n.id === pickedNomineeId)
                : null;

              return (
                <section
                  key={cat.id}
                  className={[
                    "rounded-3xl border overflow-hidden bg-white/70 border-[#0A2041]/10",
                    isOpen ? "shadow-[0_18px_60px_-50px_rgba(10,32,65,0.45)]" : "shadow-sm",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedCategoryId((cur) => (cur === cat.id ? null : cat.id))}
                    className="w-full text-left px-5 sm:px-6 py-5 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black truncate">{cat.name}</h2>
                        {pickedNominee ? (
                          <span className="text-[11px] font-black px-2 py-1 rounded-full bg-[#FEE689] text-[#0A2041]">
                            Picked
                          </span>
                        ) : (
                          <span className="text-[11px] font-black px-2 py-1 rounded-full bg-[#F9DCD8] text-[#0A2041]/75 border border-[#0A2041]/10">
                            Not picked
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-xs text-[#0A2041]/60 truncate">
                        {pickedNominee ? (
                          <>
                            Selected:{" "}
                            <span className="font-semibold text-[#0A2041]">{pickedNominee.name}</span>
                          </>
                        ) : (
                          "Tap to choose a nominee"
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {savingCategoryId === cat.id ? (
                        <span className="text-xs font-bold text-[#0A2041]/70">Saving…</span>
                      ) : null}
                      <span className="text-lg font-black text-[#CA4C4C]">{isOpen ? "–" : "+"}</span>
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="px-5 sm:px-6 pb-6">
                      {cat.nominees.length === 0 ? (
                        <div className="rounded-2xl border border-[#0A2041]/10 bg-white/60 px-4 py-4 text-sm text-[#0A2041]/70">
                          Nominees coming soon.
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {cat.nominees.map((n) => {
                            const selectedHere = selected[cat.id] === n.id;

                            return (
                              <button
                                key={n.id}
                                type="button"
                                disabled={isLocked}
                                onClick={() => chooseNominee(cat.id, n.id)}
                                className={[
                                  "w-full text-left rounded-2xl border px-4 py-4 transition",
                                  "hover:-translate-y-[1px] hover:shadow-md active:translate-y-0",
                                  selectedHere
                                    ? "border-[#CA4C4C] bg-[#FEE689]/45 shadow-sm"
                                    : "border-[#0A2041]/10 bg-white/80",
                                  isLocked ? "opacity-60 cursor-not-allowed" : "",
                                ].join(" ")}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-extrabold text-[#0A2041] truncate">{n.name}</div>
                                    {n.subtitle ? (
                                      <div className="mt-1 text-xs text-[#0A2041]/65 truncate">{n.subtitle}</div>
                                    ) : null}
                                  </div>

                                  <div
                                    className={[
                                      "h-6 w-6 rounded-full border flex items-center justify-center text-xs font-black",
                                      selectedHere
                                        ? "border-[#CA4C4C] bg-[#CA4C4C] text-[#F8F5EE]"
                                        : "border-[#0A2041]/15 bg-white text-[#0A2041]/40",
                                    ].join(" ")}
                                  >
                                    {selectedHere ? "✓" : ""}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}

        <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Link
            href="/biggest-night/leaderboard"
            className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-black bg-[#0A2041] text-[#F8F5EE] hover:opacity-95"
          >
            View Leaderboard →
          </Link>

          <div className="text-xs text-[#0A2041]/60">Your picks are saved automatically.</div>
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast.show ? (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]"
          >
            <div
              className={[
                "rounded-full px-5 py-3 shadow-lg border text-sm font-black flex items-center gap-2",
                toast.tone === "success"
                  ? "bg-[#FEE689] text-[#0A2041] border-[#0A2041]/10"
                  : toast.tone === "error"
                  ? "bg-[#CA4C4C] text-[#F8F5EE] border-[#CA4C4C]/30"
                  : "bg-[#0A2041] text-[#F8F5EE] border-white/15",
              ].join(" ")}
            >
              <span>{toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}</span>
              <span>{toast.message}</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

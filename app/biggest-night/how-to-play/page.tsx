import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Play | Hollywood’s Biggest Night",
  description:
    "Everything you need to know to play Hollywood’s Biggest Night — make picks, score points, and win ties with the tiebreaker.",
};

const SECTIONS = [
  { id: "create", label: "Create Ballot" },
  { id: "scoring", label: "Weighted Scoring" },
  { id: "lock", label: "Locking + Deadline" },
  { id: "live", label: "Live Scoring" },
  { id: "tiebreaker", label: "Tiebreaker" },
  { id: "tips", label: "Tips" },
  { id: "faq", label: "FAQ" },
];

export default function HowToPlayPage() {
  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#CA4C4C] pt-24 pb-10 px-4">
      <main className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm font-black">
          <Link
            href="/biggest-night/ballot"
            className="px-3 py-1 rounded-full border border-[#CA4C4C]/30 text-[#CA4C4C] hover:bg-[#CA4C4C]/10"
          >
            Ballot
          </Link>
        </div>

        {/* Hero */}
        <section className="rounded-3xl border border-[#CA4C4C] bg-[#CA4C4C] p-6 sm:p-8 shadow-sm">
          <span className="text-xs font-black tracking-[0.2em] uppercase text-[#F8F5EE]">
            Hollywood&apos;s Biggest Night
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-black leading-tight text-[#F8F5EE]">
            How to Play
          </h1>
          <p className="mt-3 text-base sm:text-lg text-[#F8F5EE]/80">
            Your rom-com brain + a little strategy. Pick winners, earn points,
            climb the leaderboard.
          </p>
        </section>

        {/* Jump links */}
        <section className="mt-6 rounded-2xl border border-[#CA4C4C]/25 bg-[#F9DCD8] p-4 sm:p-5">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-[#CA4C4C]/85">
            Jump to
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SECTIONS.map((item) => (
              <Link
                key={item.id}
                href={`#${item.id}`}
                className="text-xs font-bold px-3 py-2 rounded-full border border-[#CA4C4C]/30 bg-[#CA4C4C]/10 text-[#CA4C4C] hover:bg-[#CA4C4C]/20 transition"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Sections */}
        <div className="mt-8 grid gap-4">
          <section id="create" className="rounded-3xl border border-[#CA4C4C] bg-[#CA4C4C] p-6">
            <h2 className="text-lg sm:text-xl font-black text-[#F8F5EE]">Create Your Ballot</h2>
            <p className="mt-2 text-sm sm:text-base text-[#F8F5EE]/80">
              Pick one nominee in each category. Trust your gut, follow the
              buzz, or choose chaos — it’s your ballot, babe.
            </p>
          </section>

          <section id="scoring" className="rounded-3xl border border-[#CA4C4C] bg-[#CA4C4C] p-6">
            <h2 className="text-lg sm:text-xl font-black text-[#F8F5EE]">Weighted Scoring</h2>
            <p className="mt-2 text-sm sm:text-base text-[#F8F5EE]/80">
              Favorites earn fewer points. Long shots earn more. Risk = reward,
              and one bold pick can change your whole night.
            </p>
          </section>

          <section id="lock" className="rounded-3xl border border-[#CA4C4C] bg-[#CA4C4C] p-6">
            <h2 className="text-lg sm:text-xl font-black text-[#F8F5EE]">Locking + Deadline</h2>
            <p className="mt-2 text-sm sm:text-base text-[#F8F5EE]/80">
              Ballots lock at the deadline. After that, picks are sealed — no
              edits, no drama.
            </p>
          </section>

          <section id="live" className="rounded-3xl border border-[#CA4C4C] bg-[#CA4C4C] p-6">
            <h2 className="text-lg sm:text-xl font-black text-[#F8F5EE]">Live Scoring + Leaderboard</h2>
            <p className="mt-2 text-sm sm:text-base text-[#F8F5EE]/80">
              Scores update as winners are announced. Keep one eye on the show
              and the other on the leaderboard.
            </p>
          </section>

          <section id="tiebreaker" className="rounded-3xl border border-[#CA4C4C] bg-[#CA4C4C] p-6">
            <h2 className="text-lg sm:text-xl font-black text-[#F8F5EE]">Tiebreaker</h2>
            <p className="mt-2 text-sm sm:text-base text-[#F8F5EE]/80">
              Guess how long (in seconds) the Best Actress acceptance speech
              will be. Closest without going over wins any tie.
            </p>
          </section>

          <section id="tips" className="rounded-3xl border border-[#CA4C4C] bg-[#CA4C4C] p-6">
            <h2 className="text-lg sm:text-xl font-black text-[#F8F5EE]">Tips</h2>
            <p className="mt-2 text-sm sm:text-base text-[#F8F5EE]/80">
              Don’t overthink it. One bold pick + a solid tiebreaker guess can
              move you up fast.
            </p>
          </section>

          <section id="faq" className="rounded-3xl border border-[#CA4C4C] bg-[#CA4C4C] p-6">
            <h2 className="text-lg sm:text-xl font-black text-[#F8F5EE]">FAQ</h2>
            <div className="mt-4 space-y-3">
              <details className="group rounded-2xl border border-[#0A2041]/15 bg-[#F8F5EE] px-4 py-3">
                <summary className="cursor-pointer text-sm font-black text-[#0A2041] list-none">
                  What if I miss the deadline?
                </summary>
                <p className="mt-2 text-sm text-[#0A2041]/75">
                  Once the ballot locks, entries are closed. You’ll have to sit
                  this one out — but we’ll be back for the next round.
                </p>
              </details>

              <details className="group rounded-2xl border border-[#0A2041]/15 bg-[#F8F5EE] px-4 py-3">
                <summary className="cursor-pointer text-sm font-black text-[#0A2041] list-none">
                  Can I change my picks?
                </summary>
                <p className="mt-2 text-sm text-[#0A2041]/75">
                  Yep! Update anytime before the lock. After that, picks are
                  final.
                </p>
              </details>

              <details className="group rounded-2xl border border-[#0A2041]/15 bg-[#F8F5EE] px-4 py-3">
                <summary className="cursor-pointer text-sm font-black text-[#0A2041] list-none">
                  How are points calculated?
                </summary>
                <p className="mt-2 text-sm text-[#0A2041]/75">
                  Each nominee has a point value. The more surprising the win,
                  the higher the points.
                </p>
              </details>

              <details className="group rounded-2xl border border-[#0A2041]/15 bg-[#F8F5EE] px-4 py-3">
                <summary className="cursor-pointer text-sm font-black text-[#0A2041] list-none">
                  What’s the tiebreaker?
                </summary>
                <p className="mt-2 text-sm text-[#0A2041]/75">
                  Guess the length of the Best Actress acceptance speech in
                  seconds. Closest without going over wins.
                </p>
              </details>

              <details className="group rounded-2xl border border-[#0A2041]/15 bg-[#F8F5EE] px-4 py-3">
                <summary className="cursor-pointer text-sm font-black text-[#0A2041] list-none">
                  Is this the official Oscars?
                </summary>
                <p className="mt-2 text-sm text-[#0A2041]/75">
                  Nope — this is a fan game for fun, hosted by Lucy On The
                  Ground.
                </p>
              </details>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  email: string | null;
  displayName: string | null;
};

// Get initials from display name or email
function getInitials(nameOrEmail: string | null): string {
  if (!nameOrEmail) return "?";
  const text = nameOrEmail.trim();
  const base = text.includes("@") ? text.split("@")[0] : text;
  const parts = base.split(/[.\s_-]+/).filter(Boolean);
  const first = parts[0]?.[0];
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  const initials = (first ?? "").concat(second ?? "").toUpperCase();
  return initials || (base[0]?.toUpperCase() ?? "?");
}

// Generate a consistent Tailwind color class from a string seed
function getGradient(seed: string): { background: string } {
  const colors = [
    ["#FF6B6B", "#E63946"], // red
    ["#F97316", "#EA580C"], // orange
    ["#FACC15", "#EAB308"], // amber
    ["#4ADE80", "#16A34A"], // green
    ["#06B6D4", "#0891B2"], // cyan/teal
    ["#3B82F6", "#1D4ED8"], // blue
    ["#6366F1", "#4338CA"], // indigo
    ["#8B5CF6", "#6D28D9"], // violet
    ["#D946EF", "#A21CAF"], // fuchsia
    ["#EC4899", "#BE185D"], // pink
    ["#F43F5E", "#BE123C"], // rose
  ];

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  const [start, end] = colors[index];

  return {
    background: `linear-gradient(135deg, ${start}, ${end})`
  };
}


export default function UserProfileCard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user ?? null;
        if (!mounted) return;

        if (user) {
          const displayName =
            (user.user_metadata?.full_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            null;

          setProfile({
            email: user.email ?? null,
            displayName,
          });
        } else {
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const user = session?.user ?? null;
      if (!user) {
        setProfile(null);
        return;
      }
      const displayName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null;
      setProfile({ email: user.email ?? null, displayName });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-28 rounded bg-gray-200 animate-pulse" />
            <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border p-4 shadow-sm">
        <p className="text-sm text-gray-600">Not signed in.</p>
      </div>
    );
  }

 const seed = profile.email ?? profile.displayName ?? "user";
const initials = getInitials(profile.displayName ?? profile.email);
const gradient = getGradient(seed);



  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="flex items-center gap-4">
        {/* Colored Avatar */}
        <div
  className="flex h-12 w-12 items-center justify-center rounded-full text-white text-sm font-semibold select-none drop-shadow"
  style={gradient}
>
  {initials}
</div>

        <div className="min-w-0">
          <h2 className="text-lg font-semibold truncate">
            {profile.displayName ?? profile.email ?? "—"}
          </h2>
          <p className="text-sm text-gray-700 truncate">{profile.email ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unexpected error saving profile.';
}

type UsersRow = {
  id: string;
  email: string | null;
  display_name?: string | null;
  displayName?: string | null;
  username?: string | null;
  name?: string | null;
  full_name?: string | null;
};

export default function EditProfileCard() {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);

        // 1) Get current auth user
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) {
          console.error('Error loading auth user for profile:', authError.message);
          setError('Could not load profile.');
          return;
        }

        const authUser = auth.user;
        if (!authUser) {
          setError('You must be signed in to edit your profile.');
          return;
        }

        // 2) Load row from public.users
        const { data: dbUser, error: dbError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (dbError) {
          console.warn('Error loading user row from users table:', dbError.message);
        }

        const row = (dbUser ?? null) as UsersRow | null;

        // 3) Choose a starting value for display name
        const existingDisplayName =
          row?.display_name ??
          row?.displayName ??
          row?.username ??
          row?.name ??
          row?.full_name ??
          (authUser.user_metadata &&
          typeof authUser.user_metadata === 'object' &&
          'display_name' in authUser.user_metadata
            ? (authUser.user_metadata as Record<string, unknown>).display_name
            : null) ??
          (authUser.user_metadata &&
          typeof authUser.user_metadata === 'object' &&
          'full_name' in authUser.user_metadata
            ? (authUser.user_metadata as Record<string, unknown>).full_name
            : null) ??
          (authUser.email ? authUser.email.split('@')[0] : '') ??
          '';

        setDisplayName(typeof existingDisplayName === 'string' ? existingDisplayName : String(existingDisplayName ?? ''));
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Error loading auth user for save:', authError.message);
        setError('Could not save profile.');
        return;
      }

      const authUser = auth.user;
      if (!authUser) {
        setError('You must be signed in to save your profile.');
        return;
      }

      const cleanedName = displayName.trim();
      if (!cleanedName) {
        setError('Display name cannot be empty.');
        return;
      }

      // write into public.users.display_name
      const { error: upsertError } = await supabase.from('users').upsert({
        id: authUser.id,
        email: authUser.email,
        display_name: cleanedName,
      });

      if (upsertError) {
        console.error('Error saving display name:', upsertError.message);
        setError('Could not save display name. Please try again.');
        return;
      }

      setStatus('Profile updated!');
    } catch (err: unknown) {
      const message = errorMessage(err);
      console.error('Unexpected error saving profile:', message);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-[#CA4C4C] mb-2">Profile</h2>
      <p className="text-xs text-[#0A2041]/75 mb-3">
        Set the name everyone sees on the leaderboard and shared brackets.
      </p>

      {loading ? (
        <p className="text-xs text-[#0A2041]/60">Loading profile…</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-[#0A2041]/80">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-[#F5B8B0] bg-white/80 px-3 py-2 text-xs text-[#0A2041] focus:outline-none focus:ring-2 focus:ring-[#CA4C4C]/60"
              placeholder="e.g. LucyOnTheGround"
            />
            <p className="text-[10px] text-[#0A2041]/50">
              This is what will appear on the leaderboard and in shared links.
            </p>

            <div className="mt-4 pt-3 border-t border-[#F5B8B0]">
              <Link
                href="/change-password"
                className="text-xs font-semibold text-[#CA4C4C] hover:underline"
              >
                Change password
              </Link>
            </div>
          </div>

          {error && <p className="text-[11px] text-[#CA4C4C] font-medium">{error}</p>}
          {status && <p className="text-[11px] text-[#0A2041]/70">{status}</p>}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold bg-[#CA4C4C] text-[#F8F5EE] hover:bg-[#b23a3a] transition disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      )}
    </div>
  );
}

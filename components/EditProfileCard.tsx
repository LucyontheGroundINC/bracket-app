'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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

        // 3) Choose a starting value for display name
        const existingDisplayName =
          dbUser?.display_name ??
          dbUser?.displayName ??
          dbUser?.username ??
          dbUser?.name ??
          dbUser?.full_name ??
          authUser.user_metadata?.display_name ??
          authUser.user_metadata?.full_name ??
          (authUser.email ? authUser.email.split('@')[0] : '') ??
          '';

        setDisplayName(existingDisplayName);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
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

      // 🔐 This is the important part:
      // write into public.users.display_name
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
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
    } catch (err: any) {
      console.error('Unexpected error saving profile:', err);
      setError('Unexpected error saving profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/90 border border-[#F5B8B0] rounded-2xl p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-[#CA4C4C] mb-2">
        Profile
      </h2>
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
          </div>

          {error && (
            <p className="text-[11px] text-[#CA4C4C] font-medium">
              {error}
            </p>
          )}
          {status && (
            <p className="text-[11px] text-[#0A2041]/70">
              {status}
            </p>
          )}

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



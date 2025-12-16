'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Profile = {
  display_name: string | null;
  team_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');

  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setMessage(null);
      setErrorMessage(null);

      // 1) Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error('Error getting user:', userError.message);
        setErrorMessage('Error loading user. Please try again.');
        setLoading(false);
        return;
      }

      if (!user) {
        setLoading(false);
        return;
      }

      setUserEmail(user.email ?? null);
      setUserId(user.id);

      // 2) Load existing profile (if any)
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, team_name, avatar_url, bio')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error.message);
        setErrorMessage('Error loading profile.');
      } else if (data) {
        const profile = data as Profile;
        setDisplayName(profile.display_name ?? '');
        setTeamName(profile.team_name ?? '');
        setAvatarUrl(profile.avatar_url ?? '');
        setBio(profile.bio ?? '');
      }

      setLoading(false);
    };

    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setErrorMessage('You must be logged in to save your profile.');
      return;
    }

    setSaving(true);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.from('profiles').upsert(
      {
        user_id: userId,
        display_name: displayName.trim() || null,
        team_name: teamName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        bio: bio.trim() || null,
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('Error saving profile:', error.message);
      setErrorMessage('Error saving profile. Please try again.');
    } else {
      setMessage('Profile saved!');
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black p-4">
        <div className="max-w-xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">My Profile</h1>
          <p>Loading profile…</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-white text-black p-4">
        <div className="max-w-xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">My Profile</h1>
          <p className="text-sm text-gray-600">
            You&apos;re not logged in. Please log in to edit your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black p-4">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">My Profile</h1>
        <p className="text-xs text-gray-600 mb-4">
          Logged in as {userEmail ?? 'unknown user'}
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm text-black"
              placeholder="e.g. Lucy, March Madness Queen"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              This name can be shown on the leaderboard and in admin tools.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Team name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm text-black"
              placeholder="e.g. Lucy&apos;s Longshots"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Fun name for your bracket/team (optional).
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Avatar URL
            </label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm text-black"
              placeholder="Paste an image URL (optional)"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              If you have a hosted image, you can use it here.
            </p>
            {avatarUrl && (
              <div className="mt-2">
                <p className="text-[11px] text-gray-500 mb-1">Preview:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt="Avatar preview"
                  className="h-16 w-16 rounded-full object-cover border"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm text-black min-h-[80px]"
              placeholder="Trash talk, favorite teams, or bracket philosophy…"
            />
          </div>

          {message && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              {message}
            </div>
          )}
          {errorMessage && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-4 py-2 rounded-md border border-gray-900 bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

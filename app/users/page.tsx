"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function UserPage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold">User</h1>
      <p className="mt-2">{email ? `Signed in as ${email}` : "Not signed in"}</p>
      {email && (
        <button onClick={signOut} className="mt-4 rounded bg-black px-4 py-2 text-white">
          Sign out
        </button>
      )}
    </main>
  );
}

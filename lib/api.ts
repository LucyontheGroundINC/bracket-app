export async function syncUserToDB(user: {
  id: string;
  email: string;
  displayName?: string | null;
}) {
  try {
    const res = await fetch("/api/auth/sync-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Sync Failed:", data);
    }
  } catch (err) {
    console.error("Sync Error:", err);
  }
}

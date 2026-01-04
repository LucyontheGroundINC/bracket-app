// components/UploadAvatar.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  userId: string;
  onUploaded?: (publicUrl: string) => void;
  buttonText?: string;
  className?: string;
};

export default function UploadAvatar({ userId, onUploaded, buttonText = "Change photo", className }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPickFile() {
    setError(null);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        setBusy(true);
        // a stable path: <uid>/avatar.<ext>
        const ext = file.name.split(".").pop() || "png";
        const path = `${userId}/avatar.${ext}`;

        // upload with upsert so replacing is easy
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
          cacheControl: "3600",
          upsert: true,
        });
        if (upErr) throw upErr;

        // get a public URL (bucket is public for dev)
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        const publicUrl = data.publicUrl;

        onUploaded?.(publicUrl);
     } catch (e: unknown) {
  const message =
    e instanceof Error
      ? e.message
      : typeof e === "string"
      ? e
      : "Upload failed";

  setError(message);
} finally {
  setBusy(false);
}

    };
    input.click();
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onPickFile}
        disabled={busy}
        className="rounded bg-black text-white px-3 py-2 text-sm disabled:opacity-60"
      >
        {busy ? "Uploading…" : buttonText}
      </button>
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
}

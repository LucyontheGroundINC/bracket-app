// lib/avatarUrl.ts
import { supabase } from "@/lib/supabase";

export function getAvatarPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

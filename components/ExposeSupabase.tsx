"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ExposeSupabase() {
  useEffect(() => {
    (window as any).supabase = supabase;
    console.info("[dev] window.supabase is now available");
  }, []);
  return null;
}

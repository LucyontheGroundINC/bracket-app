"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

type WindowWithSupabase = Window & {
  supabase?: typeof supabase;
};

export default function ExposeSupabase() {
  useEffect(() => {
    (window as WindowWithSupabase).supabase = supabase;
    console.info("[dev] window.supabase is now available");
  }, []);

  return null;
}


import { useEffect, useState } from "react";

const KEY = "ghorba_player_slug";

export function usePlayer() {
  const [slug, setSlug] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = window.localStorage.getItem(KEY);
    setSlug(s);
    setReady(true);
  }, []);

  const choose = (s: string) => {
    window.localStorage.setItem(KEY, s);
    setSlug(s);
  };
  const clear = () => {
    window.localStorage.removeItem(KEY);
    setSlug(null);
  };

  return { slug, ready, choose, clear };
}

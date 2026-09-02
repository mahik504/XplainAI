import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const list = window.matchMedia(query);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(list.matches);
    if (list.addEventListener) {
      list.addEventListener("change", handleChange);
      return () => {
        list.removeEventListener("change", handleChange);
      };
    } else {
      list.addListener(handleChange);
      return () => {
        list.removeListener(handleChange);
      };
    }
  }, [query]);

  return matches;
}


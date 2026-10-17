"use client";

import { useEffect, useState } from "react";

const MIN_DELAY_MS = 1400;

// Shows `fallback` for at least 1.4 seconds each time the page opens. The real content
// renders hidden underneath meanwhile, so its data and images keep loading in parallel.
export function MinDelay({ fallback, children }: { fallback: React.ReactNode; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), MIN_DELAY_MS);
    // Next.js keeps recently visited pages mounted but hidden; resetting here
    // makes the delay repeat when the user comes back to this page.
    return () => {
      clearTimeout(timer);
      setReady(false);
    };
  }, []);

  // The browser can't jump to a #section while it's hidden, so do it on reveal (e.g. /appointments#book).
  useEffect(() => {
    if (ready && location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }, [ready]);

  return (
    <>
      {!ready && fallback}
      <div hidden={!ready} className="contents">
        {children}
      </div>
    </>
  );
}

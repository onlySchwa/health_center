"use client";

import { useEffect, useRef, useState } from "react";

const MIN_DELAY_MS = 300; // long enough that the skeleton never just flashes
const MAX_DELAY_MS = 8000; // give up waiting; the page's own skeletons show whatever is still loading

// Shows `fallback` until the real content underneath has loaded, for at least 0.3 seconds each
// time the page opens. The content renders hidden meanwhile; it counts as loaded once none of its
// own loading skeletons (the shared Skeleton, data-slot="skeleton") are left in it.
export function MinDelay({ fallback, children }: { fallback: React.ReactNode; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = content.current;
    let minPassed = false;
    let observer: MutationObserver | undefined;
    const loaded = () => !el?.querySelector('[data-slot="skeleton"]');
    const reveal = () => {
      observer?.disconnect();
      setReady(true);
    };

    const minTimer = setTimeout(() => {
      minPassed = true;
      if (loaded()) reveal();
    }, MIN_DELAY_MS);
    const maxTimer = setTimeout(reveal, MAX_DELAY_MS);
    if (el) {
      observer = new MutationObserver(() => {
        if (minPassed && loaded()) reveal();
      });
      observer.observe(el, { childList: true, subtree: true });
    }

    // Next.js keeps recently visited pages mounted but hidden; resetting here
    // makes the skeleton show again when the user comes back to this page.
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
      observer?.disconnect();
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
      <div ref={content} hidden={!ready} className="contents">
        {children}
      </div>
    </>
  );
}

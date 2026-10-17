"use client";

import { Pause, Play } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type Story = {
  image: StaticImageData;
  alt: string;
  tag: string;
  title: string;
  text: string;
  links: { label: string; href: string }[];
};

const SECONDS = 6;
const pad = (n: number) => String(n).padStart(2, "0");

// Auto-playing photo stories (About section). Each slide plays for SECONDS while its bar fills;
// the fill's animationend moves on. Pauses on hover/focus, while off screen, and with the pause button;
// starts paused for reduced-motion users. Swipe on touch screens.
export function StorySlider({ stories, label }: { stories: Story[]; label: string }) {
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false); // the pause button
  const [hovered, setHovered] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const swipeFrom = useRef<number | null>(null);
  const paused = stopped || hovered || !onScreen;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a browser-only setting, read once after mount
      setStopped(true);
    }
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const go = (i: number) => setIndex((i + stories.length) % stories.length);
  const story = stories[index];

  return (
    <div
      ref={ref}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onPointerDown={(e) => {
        if (e.pointerType === "touch") swipeFrom.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (swipeFrom.current === null) return;
        const dx = e.clientX - swipeFrom.current;
        swipeFrom.current = null;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
      }}
      className="relative isolate h-[clamp(560px,58vw,760px)] touch-pan-y overflow-hidden rounded-[28px] bg-baan-navy"
    >
      {stories.map((s, i) => (
        <div
          key={s.title}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-[1100ms] ease-[cubic-bezier(.4,0,.2,1)] ${i === index ? "opacity-100" : "opacity-0"}`}
        >
          <Image
            src={s.image}
            alt={s.alt}
            fill
            sizes="(max-width: 1280px) 100vw, 1240px"
            priority={i === 0}
            className={`object-cover transition-transform ease-[cubic-bezier(.2,.6,.2,1)] motion-reduce:transition-none ${
              i === index ? "scale-100 duration-[8000ms]" : "scale-112 duration-[1200ms]"
            }`}
          />
        </div>
      ))}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,38,50,.55)_0%,rgba(8,38,50,.05)_28%,rgba(8,38,50,.15)_52%,rgba(8,38,50,.88)_100%)]"
      />

      <div className="absolute inset-x-6 top-6 flex items-center justify-between gap-3 sm:inset-x-8 sm:top-7">
        <span className="inline-flex min-h-9 items-center rounded-full bg-white/18 px-4 text-sm font-semibold text-white backdrop-blur-md">
          {story.tag}
        </span>
        <div className="flex items-center gap-2">
          <span aria-live="polite" aria-atomic className="text-sm font-bold tracking-[0.04em] text-white">
            <span className="sr-only">Story </span>
            {pad(index + 1)} / {pad(stories.length)}
          </span>
          <button
            type="button"
            onClick={() => setStopped(!stopped)}
            aria-label={stopped ? "Play stories" : "Pause stories"}
            className="flex size-11 items-center justify-center rounded-full text-white hover:bg-white/15"
          >
            {stopped ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-7 px-6 pb-8 sm:px-12 sm:pb-9">
        {/* Keyed by index so each new slide's text rises in again. */}
        <div key={index} className="flex max-w-190 flex-col gap-3.5">
          <h3 className="story-rise font-display text-[clamp(38px,6vw,76px)] leading-[1.02] font-semibold tracking-[-0.02em] text-white">
            {story.title}
          </h3>
          <p className="story-rise max-w-150 text-[clamp(16px,1.5vw,19px)] leading-relaxed text-white/88 [animation-delay:130ms]">
            {story.text}
          </p>
          <div className="story-rise flex flex-wrap gap-2.5 pt-2 [animation-delay:260ms]">
            {story.links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="inline-flex min-h-11 items-center rounded-full bg-white/20 px-4.5 text-[15px] font-semibold text-white backdrop-blur-md transition-[background-color,translate] duration-200 hover:-translate-y-px hover:bg-white/32"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div role="tablist" aria-label="Choose a story" className="flex gap-2">
          {stories.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Story ${i + 1}: ${s.title}`}
              onClick={() => go(i)}
              className="flex h-6 min-w-0 flex-1 items-center rounded-md hover:bg-white/10"
            >
              <span className="relative block h-[3px] w-full overflow-hidden rounded-full bg-white/32">
                <span
                  // A fresh element per slide restarts the fill animation.
                  key={i === index ? `active-${index}` : i}
                  onAnimationEnd={i === index ? () => go(index + 1) : undefined}
                  className={`absolute inset-0 origin-left rounded-full bg-baan-mint ${
                    i < index ? "scale-x-100" : i === index ? "story-fill" : "scale-x-0"
                  }`}
                  style={i === index ? { animationDuration: `${SECONDS}s`, animationPlayState: paused ? "paused" : "running" } : undefined}
                />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

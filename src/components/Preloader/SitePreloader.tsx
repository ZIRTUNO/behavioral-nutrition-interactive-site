"use client";

import { useEffect, useRef, useState } from "react";
import {
  onPrimerProgress,
  startAssetPrimer,
} from "@/lib/assetPrimer";
import { markAppReady } from "./preloadSignal";
import styles from "./SitePreloader.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const LOGO_SRC = `${BASE_PATH}/images/hero/logo.webp`;

/**
 * First-screen images the loading screen streams itself: the logo and the
 * Hero→Identify vine seam. The HEAVY 3D assets (GLB, HDRI, draco decoder) are
 * NOT fetched here anymore — they go through the shared asset primer
 * (src/lib/assetPrimer.ts), which downloads them exactly once and hands the
 * bytes to the three.js loaders. The old design fetched them here AND let the
 * loaders re-download them, doubling ~3 MB at the worst possible moment.
 */
const LOCAL_ASSETS = [LOGO_SRC, `${BASE_PATH}/images/hero/vine-divider.webp`];

/**
 * Below-the-fold heavies warmed AFTER the reveal, while the visitor reads the
 * Hero: the About spread (paths mirror sections/About). The testimonial
 * polaroids used to be warmed here too — this branch has no section 5 to show
 * them, so those six files stay out of the boot. Loaded one at a time at low
 * priority so they never compete with anything interactive — by the time the
 * visitor scrolls down, they're already in cache instead of popping in late.
 */
const WARM_IMAGES = [
  `${BASE_PATH}/images/about/pond.webp`,
  `${BASE_PATH}/images/about/vines.webp`,
  `${BASE_PATH}/images/about/juliana.webp`,
];

const MIN_VISIBLE_MS = 600; // don't flash when assets are already cached
/** With every byte down, the brain still has real work left — draco decode,
 *  PMREM, shader compile — which on weak devices takes seconds. This is how
 *  long we wait for brain:ready before revealing anyway. The old 1.2 s was
 *  routinely shorter than that tail, so slower devices got the Hero WITHOUT
 *  the brain (it popped in later, unannounced). 4 s covers the tail on real
 *  weak hardware; a device that can't paint within it is likely broken
 *  (WebGL unavailable), where waiting longer wouldn't help either. */
const GRACE_AFTER_BYTES = 4000;
const HARD_CAP_MS = 9000; // never trap the visitor, even on a failed asset
/** One extra window past the cap when the 3D bytes are STILL streaming (dead
 *  -slow network, bar visibly moving) — cutting off then would guarantee a
 *  brainless reveal. After it, we reveal no matter what. */
const CAP_EXTENSION_MS = 6000;

/** Share of the progress bar owned by the small local images vs the primer's
 *  ~2 MB of 3D assets. Byte-weighted roughly (260 KB vs 2 MB). */
const LOCAL_WEIGHT = 0.12;

/**
 * Streams `urls`, reporting overall 0..1 progress by bytes — falling back to a
 * per-file fraction when a server omits Content-Length. A failed fetch counts as
 * complete so one bad asset can't stall the bar; the brain:ready / cap gates
 * still protect the actual reveal.
 */
async function loadWithProgress(urls: string[], onProgress: (p: number) => void) {
  const loaded = new Array(urls.length).fill(0);
  const totals = new Array(urls.length).fill(0);
  let completed = 0;

  const report = () => {
    const grand = totals.reduce((a, b) => a + b, 0);
    const sum = loaded.reduce((a, b) => a + b, 0);
    onProgress(grand > 0 ? Math.min(1, sum / grand) : completed / urls.length);
  };

  await Promise.all(
    urls.map(async (url, i) => {
      try {
        const res = await fetch(url);
        totals[i] = Number(res.headers.get("content-length")) || 0;
        if (res.body) {
          const reader = res.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            loaded[i] += value.length;
            report();
          }
        }
        loaded[i] = Math.max(loaded[i], totals[i]);
      } catch {
        /* network/404 — the brain:ready / cap gates handle the real readiness */
      } finally {
        completed += 1;
        report();
      }
    }),
  );
  onProgress(1);
}

/**
 * Post-reveal cache warmer: below-fold images one at a time at low priority.
 * (The YouTube players no longer need a script warmed — the raw postMessage
 * controller in video/youtube.ts talks straight to the embed iframe, and the
 * layout's preconnect to www.youtube.com covers the connection setup.)
 * Runs during idle time; a hidden tab just warms a little later.
 */
function warmBelowTheFold() {
  let i = 0;
  const next = () => {
    if (i >= WARM_IMAGES.length) return;
    const img = new Image();
    img.fetchPriority = "low";
    img.decoding = "async";
    img.onload = next;
    img.onerror = next;
    img.src = WARM_IMAGES[i++];
  };
  next();
}

export function SitePreloader() {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(true);

  // The scroll lock is a server-rendered <style>, so it applies from first paint
  // (before hydration). It lifts the instant we start leaving, so the saved
  // scroll position can be re-asserted onto the unlocked page.
  const locked = mounted && !leaving;

  // Readiness gate plumbing (refs so the shared `finish` always reads fresh).
  const doneRef = useRef(false);
  const localDoneRef = useRef(false);
  const primerDoneRef = useRef(false);
  const fontsReadyRef = useRef(false);
  const brainReadyRef = useRef(false);
  const minElapsedRef = useRef(false);
  const graceStartedRef = useRef(false);
  const graceElapsedRef = useRef(false);

  // Two progress sources merged into one bar (refs so either callback can
  // recompute the blend without racing React state).
  const localFracRef = useRef(0);
  const primerFracRef = useRef(0);

  useEffect(() => {
    let graceTimer: number | undefined;

    const blend = () => {
      setProgress(
        localFracRef.current * LOCAL_WEIGHT +
          primerFracRef.current * (1 - LOCAL_WEIGHT),
      );
    };

    const finish = () => {
      if (doneRef.current) return;
      if (!minElapsedRef.current) return;
      if (!localDoneRef.current || !primerDoneRef.current) return;
      if (!fontsReadyRef.current) return;
      // Bytes are down; wait for the brain to actually paint (brain:ready) or a
      // short grace, so the Hero never reveals with a hole where the brain goes.
      if (!brainReadyRef.current && !graceElapsedRef.current) {
        if (!graceStartedRef.current) {
          graceStartedRef.current = true;
          graceTimer = window.setTimeout(() => {
            graceElapsedRef.current = true;
            finish();
          }, GRACE_AFTER_BYTES);
        }
        return;
      }
      doneRef.current = true;
      setLeaving(true);
    };

    const onBrainReady = () => {
      brainReadyRef.current = true;
      finish();
    };
    if ((window as unknown as { __brainReady?: boolean }).__brainReady) {
      brainReadyRef.current = true;
    }
    window.addEventListener("brain:ready", onBrainReady);

    const minTimer = window.setTimeout(() => {
      minElapsedRef.current = true;
      finish();
    }, MIN_VISIBLE_MS);

    // Hard cap: something is wrong (a failed or dead-slow asset). Stop waiting
    // for bytes/fonts — but DON'T fake brain:ready like the old cap did: the
    // grace window in finish() still gives the brain its bounded chance to
    // paint first, so the cap can no longer reveal a Hero with an invisible
    // brain unless the device truly cannot render one at all.
    let capExtensionTimer: number | undefined;
    const forceRemaining = () => {
      minElapsedRef.current = true;
      localDoneRef.current = true;
      primerDoneRef.current = true;
      fontsReadyRef.current = true;
      finish();
    };
    const capTimer = window.setTimeout(() => {
      if (!primerDoneRef.current) {
        // The 3D bytes are still streaming — give them one bounded extension
        // (revealing now would guarantee the brain is missing). Everything
        // small stops being waited on immediately.
        minElapsedRef.current = true;
        localDoneRef.current = true;
        fontsReadyRef.current = true;
        capExtensionTimer = window.setTimeout(forceRemaining, CAP_EXTENSION_MS);
        finish();
        return;
      }
      forceRemaining();
    }, HARD_CAP_MS);

    // The heavy 3D assets — one shared download, byte progress for the bar.
    startAssetPrimer();
    const unsubscribe = onPrimerProgress((p) => {
      primerFracRef.current = p.settled
        ? 1
        : p.total > 0
          ? Math.min(1, p.loaded / p.total)
          : p.fraction;
      blend();
      if (p.settled && !primerDoneRef.current) {
        primerDoneRef.current = true;
        finish();
      }
    });

    // The small first-screen images.
    loadWithProgress(LOCAL_ASSETS, (p) => {
      localFracRef.current = p;
      blend();
    }).then(() => {
      localDoneRef.current = true;
      finish();
    });

    // Fonts: they're tiny, local and preloaded by next/font, but revealing
    // before they land let the swap reflow the page under the visitor (and
    // shift the brain's slot measurements). document.fonts.ready resolves once
    // the faces requested by the first paint are done.
    document.fonts.ready.then(() => {
      fontsReadyRef.current = true;
      finish();
    });

    return () => {
      window.removeEventListener("brain:ready", onBrainReady);
      window.clearTimeout(minTimer);
      window.clearTimeout(capTimer);
      if (capExtensionTimer != null) window.clearTimeout(capExtensionTimer);
      if (graceTimer != null) window.clearTimeout(graceTimer);
      unsubscribe();
    };
  }, []);

  // Starting to leave: this render has dropped the scroll lock. Once it commits,
  // hand off so ScrollRestoration re-asserts the saved position. A fallback timer
  // unmounts even if the opacity transitionend somehow doesn't fire. The idle
  // callback warms the below-fold heavies now that the boot bytes are through.
  useEffect(() => {
    if (!leaving) return;
    const raf = requestAnimationFrame(() => markAppReady());
    const fallback = window.setTimeout(() => setMounted(false), 900);
    let idleId: number | undefined;
    let idleTimer: number | undefined;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(warmBelowTheFold, { timeout: 4000 });
    } else {
      // Safari still lacks requestIdleCallback.
      idleTimer = window.setTimeout(warmBelowTheFold, 1500);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
      if (idleId != null) window.cancelIdleCallback?.(idleId);
      if (idleTimer != null) window.clearTimeout(idleTimer);
    };
  }, [leaving]);

  if (!mounted) return null;

  return (
    <>
      {locked && <style>{"html,body{overflow:hidden!important;}"}</style>}
      <div
        className={styles.overlay}
        data-leaving={leaving ? "true" : "false"}
        role="status"
        aria-live="polite"
        aria-label="Carregando o site"
        onTransitionEnd={(e) => {
          if (e.propertyName === "opacity" && leaving) setMounted(false);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.logo}
          src={LOGO_SRC}
          alt=""
          aria-hidden="true"
          width={360}
          height={328}
        />
        <div className={styles.track} aria-hidden="true">
          <div className={styles.fill} style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    </>
  );
}

export default SitePreloader;

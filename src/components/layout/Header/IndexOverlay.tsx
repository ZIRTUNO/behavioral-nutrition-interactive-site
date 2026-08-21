"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import styles from "./IndexOverlay.module.css";

/** Ease-in-out cubic — slow lift-off, brisk middle, decelerating arrival.
 *  The same "calm but alive" arc the rest of the site uses for travel. */
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Glide the page to an absolute scroll position over `duration` ms.
 *
 * <html> is this page's scroll container, so window.scrollTo drives it
 * directly each frame (no native `behavior:"smooth"`, whose duration the
 * browser owns and tends to drag out across this long page). The user can
 * wrest control back at any moment — a wheel / touch / key aborts the glide
 * so we never fight their input. Returns a cancel fn so a new navigation (or
 * unmount) can stop a glide already in flight.
 */
function glideScrollTo(dest: number, duration: number, onArrive: () => void) {
  const start = window.scrollY;
  const delta = dest - start;
  let raf = 0;
  let startTime = 0;

  const stop = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
  };

  const step = (now: number) => {
    if (!startTime) startTime = now;
    const t = Math.min(1, (now - startTime) / duration);
    window.scrollTo(0, start + delta * easeInOutCubic(t));
    if (t < 1) {
      raf = requestAnimationFrame(step);
    } else {
      stop();
      onArrive();
    }
  };

  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);
  raf = requestAnimationFrame(step);

  return stop;
}

/** All 7 site sections, in scroll order. The hash references match anchor
 *  ids that the section components will declare as they're added.
 *  This branch ships without Depoimentos (see app/page.tsx), so the sumário
 *  drops that entry and renumbers 05-07 — a numeral pointing at a section
 *  that isn't on the page would scroll nowhere. */
const SECTIONS = [
  { num: "01", label: "Início",              href: "#inicio" },
  { num: "02", label: "Você se identifica?", href: "#para-quem" },
  { num: "03", label: "Como funciona",       href: "#como-funciona" },
  { num: "04", label: "Sobre Juliana",       href: "#sobre" },
  { num: "05", label: "Atendimento",         href: "#atendimento" },
  { num: "06", label: "Dúvidas",             href: "#duvidas" },
  { num: "07", label: "Vamos conversar",     href: "#contato" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-screen "table of contents" overlay. Triggered by the header's
 * ÍNDICE button, opens as a luxe magazine sumário: each section gets
 * an italic-serif gold numeral and a sans-caps label, items stagger
 * into place after the backdrop fades in.
 *
 * Closes on:
 *   - clicking any section link (which then scrolls to that section)
 *   - clicking the × button top-right
 *   - pressing Escape
 *   - clicking the backdrop (outside the content column)
 */
/** Keyboard scroll keys suppressed while the overlay is open (see below —
 *  the background is no longer overflow-locked). Space is " " in `e.key`. */
const SCROLL_KEYS = new Set([
  " ",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

export function IndexOverlay({ open, onClose }: Props) {
  // Close on Escape — global listener active only while the overlay is open.
  //
  // The same listener also blocks keyboard scrolling of the page behind.
  // Background scroll containment used to be `overflow: hidden` on <html>,
  // but toggling overflow on the ROOT scroller invalidates layout and
  // layerization for the ENTIRE 20k-px document — on every open AND close.
  // On slower machines (and under open/close spam) that showed up as the tab
  // freezing for seconds before the menu appeared. Wheel and touch scrolling
  // are instead contained by the overlay itself — it is a full-viewport
  // scroll container with `overscroll-behavior: contain` (IndexOverlay
  // .module.css), so those gestures never chain through to the page — and
  // keyboard scrolling (which targets the root scroller when focus sits on
  // <body>) is suppressed here. Interactive targets are left alone so
  // Space/Enter still activate the header's × button and the links.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (
        SCROLL_KEYS.has(e.key) &&
        !(e.target as HTMLElement | null)?.closest(
          "a, button, input, textarea, select",
        )
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Holds the cancel fn of an in-flight glide so a second tap (or unmount)
  // can abort it cleanly instead of two glides fighting over the scroll.
  const cancelGlide = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelGlide.current?.(), []);

  // Focus management (ver useDialogFocus): foco entra no dialog ao abrir, Tab
  // cicla entre os links + o X do header, e ao fechar o foco volta ao
  // hambúrguer. aria-modal sozinho não segura o TECLADO fora da página velada.
  const dialogRef = useDialogFocus<HTMLDivElement>(open);

  // Clicking a section: dissolve the overlay and glide the page to the
  // section instead of the browser's hard hash-jump. The CSS opacity fade on
  // the overlay (0.25s) lifts the veil while the page is still gliding, so the
  // travel reads as a smooth reveal rather than a dry cut.
  const handleNavigate = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.getElementById(href.slice(1));
    // Can't resolve the anchor → let the browser do its default thing.
    if (!target) {
      onClose();
      return;
    }
    e.preventDefault();

    // Start the overlay fading out; the CSS opacity fade (0.25s) lifts the
    // veil while the glide below is already moving. There is no scroll lock
    // to release anymore (see the keydown effect above), so the programmatic
    // glide is never at risk of being swallowed by overflow:hidden.
    onClose();
    cancelGlide.current?.();

    // Land the section just below the sticky header (its real, resolved
    // height — not the raw clamp() token), clamped so #inicio rests at the top.
    const headerH = document.querySelector("header")?.offsetHeight ?? 0;
    const dest = Math.max(
      0,
      window.scrollY + target.getBoundingClientRect().top - headerH,
    );
    const arrive = () => history.replaceState(null, "", href);

    // Reduced motion → land instantly, no glide.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, dest);
      arrive();
      return;
    }

    const distance = Math.abs(dest - window.scrollY);
    if (distance < 4) {
      arrive();
      return;
    }

    // Distance-aware duration: short hops stay perceptible, and even a
    // top-to-bottom jump stays brisk (capped ~0.7s) so it never drags.
    const duration = Math.min(700, Math.max(420, distance * 0.45));
    cancelGlide.current = glideScrollTo(dest, duration, arrive);
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className={`${styles.overlay} ${open ? styles.open : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label="Índice das seções"
      aria-hidden={!open}
      onClick={onClose}
    >
      {/* No close button inside the overlay — the hamburger button in
          the header morphs into an X while the overlay is open and
          serves as the close affordance, keeping interaction anchored
          to a single, predictable spot. Esc and backdrop click also
          close (handled below + by the parent setOpen toggle). */}

      {/* Inner column — stops click-through so clicking around the items
          doesn't close the overlay; only the outer backdrop does. */}
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <span className={styles.eyebrow}>Índice</span>

        <ol className={styles.list}>
          {SECTIONS.map((s, i) => (
            <li
              key={s.num}
              className={styles.item}
              style={{ "--i": i } as CSSProperties}
            >
              <a
                href={s.href}
                className={styles.link}
                onClick={(e) => handleNavigate(e, s.href)}
              >
                <span className={styles.num} aria-hidden="true">
                  {s.num}
                </span>
                <span className={styles.label}>{s.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default IndexOverlay;

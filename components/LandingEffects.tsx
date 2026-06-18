"use client";

import { useEffect } from "react";

/**
 * Client-only landing visuals, ported from the original inline scripts:
 *  - fade-up entrance animations via IntersectionObserver
 *  - floating background crowns
 *
 * (The original also had a charity-bar / charity-total counter targeting markup
 * that no longer exists — those were dead no-ops and are intentionally dropped.)
 */
export default function LandingEffects() {
  useEffect(() => {
    // Fade-in on scroll
    const fadeEls = document.querySelectorAll<HTMLElement>(".fade-up");
    const fadeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            fadeObserver.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    fadeEls.forEach((el) => fadeObserver.observe(el));

    // Floating crowns
    const container = document.getElementById("crownContainer");
    const crowns = ["👑", "👑", "⭐"];
    const timers: number[] = [];
    function spawnCrown() {
      if (!container) return;
      const el = document.createElement("div");
      el.className = "crown-float";
      el.textContent = crowns[Math.floor(Math.random() * crowns.length)];
      el.style.left = Math.random() * 100 + "vw";
      el.style.animationDuration = 12 + Math.random() * 18 + "s";
      el.style.fontSize = 1.2 + Math.random() * 1.6 + "rem";
      container.appendChild(el);
      el.addEventListener("animationend", () => el.remove());
    }
    const interval = window.setInterval(spawnCrown, 2500);
    for (let i = 0; i < 6; i++) timers.push(window.setTimeout(spawnCrown, i * 400));

    return () => {
      fadeObserver.disconnect();
      window.clearInterval(interval);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return null;
}

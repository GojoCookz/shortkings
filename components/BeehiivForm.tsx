"use client";

import { useEffect, useRef } from "react";

/**
 * Loads the beehiiv subscribe-form loader into a fixed slot, replicating the
 * original inline <script> placement (injected scripts via innerHTML don't run,
 * so we append a real <script> element on mount).
 */
export default function BeehiivForm({ formId }: { formId: string }) {
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || slot.querySelector("script")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://subscribe-forms.beehiiv.com/v3/loader.js";
    s.setAttribute("data-beehiiv-form", formId);
    slot.appendChild(s);
  }, [formId]);

  return <div className="beehiiv-slot" ref={slotRef} />;
}

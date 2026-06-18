"use client";

import { useMemo, useState } from "react";

export default function DashboardClient({
  referralCode,
  count,
  siteUrl,
}: {
  referralCode: string;
  count: number;
  siteUrl: string;
}) {
  const shareLink = useMemo(() => {
    const raw = siteUrl || (typeof window !== "undefined" ? window.location.origin : "");
    const base = raw.replace(/\/+$/, ""); // tolerate a trailing slash in env
    return `${base}/?ref=${referralCode}`;
  }, [siteUrl, referralCode]);

  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function shareOnX() {
    const text = "Long live the Short Kings. 👑 Join the $SHORT hotline:";
    const url =
      "https://twitter.com/intent/tweet?text=" +
      encodeURIComponent(text) +
      "&url=" +
      encodeURIComponent(shareLink);
    window.open(url, "_blank", "noopener");
  }

  return (
    <>
      <div className="dash-grid">
        <div className="dash-card">
          <div className="dc-label">Kings Recruited</div>
          <div className="dc-big">{count}</div>
        </div>
        <div className="dash-card">
          <div className="dc-label">Your Code</div>
          <div className="dc-code">{referralCode}</div>
        </div>
      </div>

      <div className="dash-card">
        <div className="dc-label">Your Royal Link</div>
        <div className="ref-link-row">
          <input type="text" readOnly value={shareLink} aria-label="Your referral link" />
          <button className="ref-copy-btn" onClick={copy}>
            {copied ? "COPIED!" : "COPY"}
          </button>
        </div>
        <button className="ref-x-btn" onClick={shareOnX}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Share on X
        </button>
      </div>
    </>
  );
}

import Link from "next/link";
import Script from "next/script";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import LandingEffects from "@/components/LandingEffects";
import BeehiivForm from "@/components/BeehiivForm";
import WalletButton from "@/components/WalletButton";

const BAGS = "https://bags.fm/A8cMYsw7YaGmB1htaeF9bww4nGjN1czti5RNh2viBAGS";
const CONTRACT = "A8cMYsw7YaGmB1htaeF9bww4nGjN1czti5RNh2viBAGS";
const BEEHIIV_FORM = "78243337-c29b-4d55-8c4e-49f7bc16c71b";

function BagsLogo() {
  return (
    <svg
      className="bags-logo"
      viewBox="0 0 512 512"
      role="img"
      aria-label="Bags logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="bagGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3dff63" />
          <stop offset="1" stopColor="#05c236" />
        </linearGradient>
      </defs>
      {/* cinched top / "lips" */}
      <path
        d="M171 158 C150 116 152 74 193 58 C215 49 233 74 256 74 C279 74 297 49 319 58 C360 74 362 116 341 158 Z"
        fill="url(#bagGrad)"
      />
      {/* bag body */}
      <path
        d="M188 156 C123 203 74 271 74 332 C74 420 153 472 256 472 C359 472 438 420 438 332 C438 271 389 203 324 156 Z"
        fill="url(#bagGrad)"
      />
      {/* dollar sign */}
      <text
        x="256"
        y="348"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="235"
        fontWeight="900"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="#ffffff"
      >
        $
      </text>
    </svg>
  );
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const HERO_KINGS = [
  "ae80967c-6990-4563-bdda-7a6b191c81ae.png",
  "94c29d41-d184-451f-9929-967500613978.png",
  "b183c440-33ce-423d-bd72-cad81d438f72.png",
  "9afdd064-c4ae-46dc-b761-48a254ff11b2.png",
  "87fa1890-ed01-478c-b9f5-cd50eb2083aa.png",
];

const TICKER = [
  "GOD'S FAVORITE HEIGHT",
  "COMPACT KINGS DON'T MISS",
  "SHORTER THE KING, TALLER THE CROWN",
  "5'7\" IS A PERSONALITY",
  "WE BUILT DIFFERENT (JUST LOWER)",
  "CARRY THE WORLD, FIT IN ANY CAR",
  "ALL DRIP, NO STILTS",
  "HEIGHT IS TEMPORARY, CROWN IS FOREVER",
];

const PERKS = [
  { icon: "⚡", title: "Lower Center of Gravity", body: "You're basically a sports car. Built low, handles tight, corners like a dream. Physics chose you." },
  { icon: "💦", title: "Unlimited Legroom", body: "Economy seat? More like first class for free. Every plane, every bus, every movie theater — your kingdom." },
  { icon: "💪", title: "Gains Look Insane", body: "Put on 5 lbs of muscle and suddenly you look like a Greek statue. Tall guys need 20 lbs for the same effect. Efficiency, king." },
  { icon: "👑", title: "Crown Sits Closer to the Brain", body: "Less distance between the crown and the thoughts. That's called an optimized pipeline. Look it up." },
  { icon: "🚀", title: "First Into the Lambo", body: "Sports cars are literally designed for short kings. McLaren engineers? Short king council members. Confirmed." },
  { icon: "🧡", title: "Big Heart Energy", body: "A portion of every $SHORT transaction goes to charity automatically. We're short, not heartless." },
];

const CHARITY = [
  { img: "kipp.jpg", name: "KIPP", x: "KIPP", pct: "20%", amt: "$38.29" },
  { img: "uncf.jpg", name: "UNCF", x: "UNCF", pct: "20%", amt: "$38.29" },
  { img: "Kevinhart4real.jpg", name: "KevinHart4real", x: "KevinHart4real", pct: "15%", amt: "$28.72" },
  { img: "shortkingsbags.jpg", name: "ShortKingsbags", x: "ShortKingsbags", pct: "15%", amt: "$28.72", crown: true },
  { img: "cryptomagz.jpg", name: "cryptomagz", x: "cryptomagz", pct: "10%", amt: "$19.14" },
  { img: "BESC.jpg", name: "BESCLLC", x: "BESCLLC", pct: "10%", amt: "$19.14" },
  { img: "FUSD.jpg", name: "FUSDFinance", x: "FUSDFinance", pct: "10%", amt: "$19.14" },
];

export default async function Home() {
  // Resolve auth state, but never let a missing/misconfigured Supabase env crash
  // the marketing page — fall back to logged-out.
  let isLoggedIn = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isLoggedIn = !!user;
  } catch {
    isLoggedIn = false;
  }

  const cookieStore = await cookies();
  const wasInvited = !!cookieStore.get("sk_ref");

  return (
    <div className="sk-landing">
      {/* ruler decoration */}
      <div className="ruler-deco" aria-hidden="true"></div>

      {/* floating crowns */}
      <div id="crownContainer" aria-hidden="true"></div>

      {/* ===== NAV ===== */}
      <nav className="topnav">
        <div className="topnav-logo">$SHORT</div>
        <div className="topnav-links">
          <a href="#perks">Perks</a>
          <a href="#hotline">Hotline</a>
          <a href="#chart">Chart</a>
          <a href="#charity">Charity</a>
          <a href="https://x.com/shortkingsbags" target="_blank" rel="noopener" aria-label="X (Twitter)" style={{ display: "inline-flex", alignItems: "center" }}>
            <XIcon size={16} />
          </a>
          <Link href={isLoggedIn ? "/dashboard" : "/login"}>
            {isLoggedIn ? "Dashboard" : "Log in"}
          </Link>
          <a href="#buy">Buy</a>
          <WalletButton />
        </div>
      </nav>

      {/* ===== 1. HERO ===== */}
      <section className="hero" id="top">
        <div className="hero-content">
          <div className="hero-badge">Now accepting calls</div>

          <h1>
            <span className="gold-text">Short Kings</span>
            <br />
            <span style={{ color: "var(--text)" }}>Hotline</span>
          </h1>

          <p className="hero-subtext">
            Yeah, you&apos;re short. We know. The weather down here is fine, thanks for asking.
            This is your support line, your community, and your token.
          </p>
          <p className="hero-disclaimer">
            Side effects include: excessive confidence, involuntary crown-adjusting, and gains.
          </p>

          <div className="hero-buttons">
            <a href={BAGS} target="_blank" rel="noopener" className="btn btn-gold">Buy $SHORT on bags.fm</a>
            <a href="#perks" className="btn btn-outline">Why It&apos;s Fire</a>
          </div>

          <div className="hero-kings">
            {HERO_KINGS.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={`/${src}`} alt={`Short King ${i + 1}`} />
            ))}
          </div>

          <div className="hero-ticker">$SHORT</div>
          <div className="hero-contract">{CONTRACT}</div>
        </div>
      </section>

      {/* ===== 2. TICKER STRIP ===== */}
      <div className="hotline-strip">
        <div className="hotline-track">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>

      {/* ===== 3. WHY IT'S FIRE BEING SHORT ===== */}
      <section className="section" id="perks">
        <div className="section-tag">Proven facts (trust us)</div>
        <h2 className="section-title">Why Being Short Is <span className="gold-text">Actually Fire</span></h2>
        <p className="section-subtitle">You thought this was a disability? Nah. It&apos;s a cheat code. Here&apos;s the evidence.</p>

        <div className="perks-grid">
          {PERKS.map((p) => (
            <div className="perk-card fade-up" key={p.title}>
              <span className="perk-icon">{p.icon}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 4. THE HOTLINE ===== */}
      <section className="section" id="hotline">
        <div className="section-tag">Ring ring</div>
        <h2 className="section-title">The <span className="gold-text">Hotline</span></h2>
        <p className="section-subtitle">Real calls. Real kings. Real talk. (None of this is real.)</p>

        <div className="hotline-section fade-up">
          <div className="hotline-phone">1-800-SHORT-W</div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "8px" }}>
            (That&apos;s 1-800-746-7889 but we ran out of digits, kinda like our height)
          </p>

          <div className="caller-msg">
            <div className="caller-name">Caller #0421</div>
            <p>&quot;My girl said I&apos;m too short to reach the top shelf. What do I do?&quot;</p>
            <p className="response">&quot;King, you don&apos;t reach for shelves. You buy lower shelves. That&apos;s called wealth.&quot;</p>
          </div>

          <div className="caller-msg">
            <div className="caller-name">Caller #0587</div>
            <p>&quot;People keep asking me if I play miniature golf.&quot;</p>
            <p className="response">&quot;Tell them you play regular golf — the course just looks bigger when you&apos;re on it. Perspective is a superpower.&quot;</p>
          </div>

          <div className="caller-msg">
            <div className="caller-name">Caller #1203</div>
            <p>&quot;I stood on my money and I&apos;m still 5&apos;6&quot;.&quot;</p>
            <p className="response">&quot;Stack higher. That&apos;s not a height problem, that&apos;s a portfolio problem. Buy more $SHORT.&quot;</p>
          </div>
        </div>
      </section>

      {/* ===== 5. TOKENOMICS ===== */}
      <section className="section" id="tokenomics">
        <div className="section-tag">The short end of the stick (it&apos;s a good stick)</div>
        <h2 className="section-title">Token<span className="gold-text">omics</span></h2>
        <p className="section-subtitle">No insider bags. No dev allocation. No one&apos;s walking away with more than their fair share. The token is as honest as your dating profile height should be.</p>

        <div className="tokenomics-grid fade-up">
          <div className="token-stat"><div className="stat-val">1B</div><div className="stat-label">Total Supply</div></div>
          <div className="token-stat"><div className="stat-val">0%</div><div className="stat-label">Team Alloc</div></div>
          <div className="token-stat"><div className="stat-val">Auto</div><div className="stat-label">Charity Route</div></div>
          <div className="token-stat"><div className="stat-val">100%</div><div className="stat-label">Community</div></div>
        </div>
      </section>

      {/* ===== LIVE CHART ===== */}
      <section className="section" id="chart">
        <div className="section-tag">Live from the trading floor</div>
        <h2 className="section-title">The <span className="gold-text">Chart</span></h2>
        <p className="section-subtitle">Watch $SHORT do its thing. Real-time. No cap (except market cap).</p>
        <div className="dex-embed fade-up">
          <div id="dexscreener-embed">
            <iframe
              title="$SHORT live chart"
              src="https://dexscreener.com/solana/FZEnmFGMUcbfPuNSn45njNsdF4CZPrStotatRKZTBvHD?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"
            ></iframe>
          </div>
        </div>
      </section>

      {/* ===== 6. CHARITY TRACKER ===== */}
      <section className="section charity-section" id="charity">
        <BagsLogo />
        <div className="section-tag">Short kings give back</div>
        <h2 className="section-title">Bags Fee&apos;s <span className="gold-text">Tracker</span></h2>
        <p className="section-subtitle">Every trade pays royalties, and those royalties auto-split to the wallets below — fixed percentages, set on-chain through bags.fm. No insider cuts.</p>

        <div className="earnings-panel fade-up">
          <div className="earnings-total">
            <div className="et-label">Total Routed to Recipients</div>
            <div className="et-val">$191.44</div>
          </div>
          <div className="earnings-list">
            {CHARITY.map((c) => (
              <div className="earnings-row" key={c.x}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="er-avatar" src={`/${c.img}`} alt={`${c.name} logo`} />
                <div className="er-name">
                  {c.name}
                  {c.crown && <span className="crown">👑</span>}
                  <a className="er-x" href={`https://x.com/${c.x}`} target="_blank" rel="noopener" aria-label={`${c.name} on X`}>
                    <XIcon size={11} />
                  </a>
                </div>
                <span className="er-pct">{c.pct}</span>
                <div className="er-amt">{c.amt}</div>
              </div>
            ))}
          </div>
          <div className="earnings-foot">
            Royalty split enforced on-chain via <a href={BAGS} target="_blank" rel="noopener">bags.fm</a>
          </div>
        </div>
      </section>

      {/* ===== 7. HOW TO BUY ===== */}
      <section className="section" id="buy">
        <div className="section-tag">Three steps, no stool needed</div>
        <h2 className="section-title">How to <span className="gold-text">Buy</span></h2>
        <p className="section-subtitle">It&apos;s easier than convincing your friends you&apos;re 5&apos;10&quot;.</p>

        <div className="steps-row fade-up">
          <div className="step-card">
            <span className="step-num">1</span>
            <h3>Get a Wallet</h3>
            <p>Download Phantom, MetaMask, or whatever wallet matches your vibe. Fund it up. This is your crown fund.</p>
          </div>
          <div className="step-card">
            <span className="step-num">2</span>
            <h3>Hit bags.fm</h3>
            <p>Search for $SHORT. Connect wallet. Swap. Done. Took less time than explaining your height on a dating app.</p>
          </div>
          <div className="step-card">
            <span className="step-num">3</span>
            <h3>Hold &amp; Rep</h3>
            <p>Hold your $SHORT, watch the charity tracker climb, and join the community. You&apos;re a Short King now. Act like it.</p>
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <a href={BAGS} target="_blank" rel="noopener" className="btn btn-gold">Buy $SHORT on bags.fm</a>
        </div>
      </section>

      {/* ===== 7.5 JOIN THE MOVEMENT ===== */}
      <section className="section" id="join">
        <div className="section-tag">Build the dynasty</div>
        <h2 className="section-title">Join the <span className="gold-text">Movement</span></h2>
        <p className="section-subtitle">Get the Hotline Dispatch in your inbox, and recruit your court. Every king you bring makes the kingdom bigger.</p>

        {wasInvited && (
          <div className="invited-badge" style={{ display: "flex" }}>
            👑 You were invited by a fellow King
          </div>
        )}

        <div className="join-grid fade-up">
          <div className="join-card">
            <h3>The Hotline Dispatch</h3>
            <p className="jc-sub">Drops, charity updates, and the funniest moments of short kings who made it. No spam, all crown.</p>
            <BeehiivForm formId={BEEHIIV_FORM} />
          </div>

          <div className="join-card">
            <h3>Recruit Your Court</h3>
            <p className="jc-sub">Share your royal link and earn for every king you bring. Your code and live recruit count live on your dashboard.</p>
            <Link className="recruit-cta" href={isLoggedIn ? "/dashboard" : "/signup"}>
              {isLoggedIn ? "Open your dashboard 👑" : "Claim your referral link 👑"}
            </Link>
            <div className="recruit-note">
              {isLoggedIn
                ? "Your real code and share link are ready in the dashboard."
                : "Free to join — sign up and your unique Short King code is generated instantly."}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 8. FOOTER ===== */}
      <footer className="footer">
        <span className="footer-crown" aria-hidden="true">👑</span>
        <p className="footer-tagline">HEIGHT IS TEMPORARY. CROWN IS FOREVER.</p>
        <div className="footer-socials">
          <a href="https://x.com/shortkingsbags" target="_blank" rel="noopener" aria-label="X (Twitter)">
            <XIcon size={18} />
          </a>
          <a href="https://t.me/ShortKingsBags" target="_blank" rel="noopener" aria-label="Telegram">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </a>
        </div>
        <p className="footer-disclaimer">
          $SHORT is a community memecoin with no intrinsic value or expectation of financial return.
          Not financial advice. Not height advice either. All charitable donations are tracked on-chain
          and routed through bags.fm via each charity&apos;s X handle. DYOR.
        </p>
        <p className="footer-copy">© 2026 Short Kings Hotline ($SHORT). All rights reserved. Except height. We don&apos;t reserve that.</p>
      </footer>

      <LandingEffects />

      {/* beehiiv attribution — forwards UTM params to subscribe form */}
      <Script
        src="https://subscribe-forms.beehiiv.com/attribution.js"
        strategy="afterInteractive"
      />
    </div>
  );
}

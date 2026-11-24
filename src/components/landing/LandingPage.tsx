"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { BrandMark } from "@/components/BrandMark";
import { BRAND_NAME } from "@/lib/brand";
import { DATA_SOURCE } from "@/lib/data-sources";
import { POSITIONING } from "@/lib/positioning";
import { PAYMENTS_ENABLED } from "@/lib/billing";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: "easeOut" as const },
  }),
};

/** Contact-sheet frames -- the signature hero element. Real sample rows,
 * not decoration: this is what browsing the library actually looks like. */
const frames = [
  { n: "01", name: "FitLife Pro", subs: "248K", score: 87 },
  { n: "02", name: "Yoga With Ana", subs: "1.2M", score: 92 },
  { n: "03", name: "Home Gym Hub", subs: "89K", score: 78 },
  { n: "04", name: "Marta Runs", subs: "56K", score: 81 },
  { n: "05", name: "Coach Devon", subs: "312K", score: 90 },
  { n: "06", name: "Lift & Learn", subs: "14K", score: 74 },
];

const features = [
  {
    code: "LIB",
    title: "Your creator library",
    desc: "Browse enriched YouTube profiles with scores, emails, and USA & Europe filters — your scraped database, ready for outreach.",
  },
  {
    code: "SCR",
    title: "Influencer scoring",
    desc: "Weighted scores from subscribers, engagement, views, and upload consistency to shortlist faster.",
  },
  {
    code: "OUT",
    title: "Email outreach",
    desc: PAYMENTS_ENABLED
      ? "AI-assisted outreach emails when a business email exists. Subscribe to unlock full addresses and export."
      : "Outreach email drafts for every creator. Full addresses and export arrive with Pro, coming soon.",
  },
  {
    code: "LST",
    title: "Campaign lists",
    desc: "Organize creators into lists, mark contacted and replied, and export CSV for your team.",
  },
  {
    code: "GRW",
    title: "Nightly library growth",
    desc: "An automated pipeline discovers, validates, and quality-scores new creators every night — no manual searching needed.",
  },
  {
    code: "TRK",
    title: "Outreach tracking",
    desc: "See contacted, replied, and reply rate by list — pipeline visibility, not campaign ROI or promo codes.",
  },
];

const steps = [
  {
    step: "01",
    title: "Browse your library",
    desc: "Start with pre-enriched YouTube creators in your niche. Filter by subscribers, email, and USA & Europe.",
  },
  {
    step: "02",
    title: "Save to lists",
    desc: "Review scores and tiers, then add top picks to campaign lists to start outreach.",
  },
  {
    step: "03",
    title: "Outreach & track",
    desc: "Unlock emails, send outreach, and mark contacted and replied. See reply rates by list in Campaign insights.",
  },
];

const ledger = [
  { value: "500+", label: "Enriched profiles" },
  { value: "USA & EU", label: "Market focus" },
  { value: "LISTS", label: "Pipeline tracking" },
  PAYMENTS_ENABLED
    ? { value: "$9/MO", label: "Pro email unlock" }
    : { value: "FREE", label: "Browse & build lists" },
];

export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
    <div className="mkt-shell selection:bg-mkt-tally/30 selection:text-mkt-ink">
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b mkt-hairline bg-mkt-ink/90 backdrop-saturate-150">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/">
            <BrandMark size="lg" variant="mkt" />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="font-mono text-xs uppercase tracking-wider text-mkt-ash transition hover:text-mkt-paper"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="font-mono text-xs uppercase tracking-wider text-mkt-ash transition hover:text-mkt-paper"
            >
              How it works
            </a>
            <a
              href="#pricing"
              className="font-mono text-xs uppercase tracking-wider text-mkt-ash transition hover:text-mkt-paper"
            >
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden font-mono text-xs uppercase tracking-wider text-mkt-ash transition hover:text-mkt-paper sm:inline"
            >
              Sign in
            </Link>
            <Link href="/channels" className="mkt-btn-primary !min-h-[40px] px-4 text-xs">
              Browse database
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 md:pt-44 md:pb-28">
        <div className="mx-auto grid max-w-6xl gap-16 px-4 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          {/* Left: thesis */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mkt-eyebrow"
            >
              {POSITIONING.scope} — Creator Index
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mkt-h1 mt-4"
            >
              Find the
              <br />
              right creator.
              <br />
              <span className="text-mkt-tally">Not a list of names.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mkt-body mt-6 max-w-md"
            >
              {POSITIONING.workflow}. Your enriched YouTube library, not a cold list bought in
              bulk.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Link href="/channels" className="mkt-btn-primary">
                Browse your database
              </Link>
            </motion.div>
          </div>

          {/* Right: contact sheet -- the signature element */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mkt-card p-3"
          >
            <div className="flex items-center justify-between border-b mkt-hairline pb-2 font-mono text-[11px] uppercase tracking-wider text-mkt-ash">
              <span>Contact sheet — creator_library.roll</span>
              <span className="text-mkt-tally">● live</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {frames.map((f, i) => (
                <motion.div
                  key={f.n}
                  custom={i}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  className="group relative aspect-square overflow-hidden rounded-sm border border-mkt-manila/25 bg-mkt-ink p-2"
                >
                  <span className="mkt-frame-count absolute left-1.5 top-1.5">{f.n}</span>
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-mkt-manila/40 font-poster text-sm text-mkt-paper">
                      {f.name.charAt(0)}
                    </div>
                    <p className="font-plex text-[11px] font-medium leading-tight text-mkt-paper">
                      {f.name}
                    </p>
                    <p className="font-mono text-[10px] text-mkt-ash">{f.subs} subs</p>
                  </div>
                  <span className="absolute bottom-1.5 right-1.5 font-mono text-[10px] font-semibold text-mkt-signal">
                    {f.score}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Ledger strip */}
      <section className="border-y mkt-hairline bg-white/[0.015] py-8">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 font-mono md:grid-cols-4 md:gap-8">
          {ledger.map((s, i) => (
            <motion.div
              key={s.label}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="border-l mkt-hairline pl-4"
            >
              <p className="text-xl font-semibold uppercase tracking-tight text-mkt-paper md:text-2xl">
                {s.value}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-mkt-ash">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="max-w-2xl"
          >
            <p className="mkt-eyebrow">Features</p>
            <h2 className="mkt-h2 mt-3">Built for outreach workflows</h2>
            <p className="mkt-body mt-4">
              Library, scoring, lists, and reply tracking — honest scope for marketers and
              agencies working USA & Europe creators.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-sm border mkt-hairline bg-mkt-manila/25 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="bg-mkt-ink p-6 transition hover:bg-white/[0.03]"
              >
                <span className="mkt-tag">{f.code}</span>
                <h3 className="mkt-h3 mt-4 !text-lg">{f.title}</h3>
                <p className="mkt-body mt-2 !text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t mkt-hairline bg-white/[0.015] py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="max-w-2xl"
          >
            <p className="mkt-eyebrow">How it works</p>
            <h2 className="mkt-h2 mt-3">Three steps to your outreach list</h2>
            <p className="mt-4 font-mono text-xs uppercase tracking-wider text-mkt-ash">
              {POSITIONING.notIncluded}
            </p>
          </motion.div>

          <div className="relative mt-16 grid gap-10 md:grid-cols-3">
            <div className="mkt-perforation absolute left-0 right-0 top-6 hidden h-2 md:block" />
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-poster text-4xl text-mkt-tally">{s.step}</span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-mkt-ash">
                    frame
                  </span>
                </div>
                <h3 className="mkt-h3 mt-3 !text-xl">{s.title}</h3>
                <p className="mkt-body mt-3 !text-sm">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="max-w-2xl"
          >
            <p className="mkt-eyebrow">Pricing</p>
            <h2 className="mkt-h2 mt-3">
              {PAYMENTS_ENABLED ? "Start free. Upgrade when ready." : "Free while we build. Pro is coming."}
            </h2>
          </motion.div>

          <div className="mt-16 grid max-w-4xl gap-6 md:grid-cols-2">
            <motion.div
              custom={0}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="mkt-card p-8"
            >
              <p className="mkt-tag">Free</p>
              <p className="mt-4 font-poster text-5xl text-mkt-paper">$0</p>
              <p className="mt-1 font-mono text-xs uppercase tracking-wider text-mkt-ash">
                Forever free tier
              </p>
              <ul className="mt-8 space-y-3 text-sm text-mkt-ash">
                <li className="flex gap-2">
                  <span className="text-mkt-signal">✓</span> Your creator database
                </li>
                <li className="flex gap-2">
                  <span className="text-mkt-signal">✓</span> Influencer scoring
                </li>
                <li className="flex gap-2">
                  <span className="text-mkt-signal">✓</span> Campaign list building
                </li>
                <li className="flex gap-2">
                  <span className="text-mkt-ash/60">○</span> Masked email addresses
                </li>
              </ul>
              <Link href="/channels" className="mkt-btn-secondary mt-8 w-full">
                Browse database free
              </Link>
            </motion.div>

            <motion.div
              custom={1}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="mkt-card relative overflow-visible border-mkt-tally/50 p-8"
            >
              <div className="mkt-stamp absolute -right-3 -top-3 bg-mkt-ink">
                {PAYMENTS_ENABLED ? "Popular" : "Soon"}
              </div>
              <p className="mkt-tag border-mkt-tally/40 text-mkt-tally">Pro</p>
              {PAYMENTS_ENABLED ? (
                <p className="mt-4 font-poster text-5xl text-mkt-paper">
                  $9<span className="text-lg font-plex font-normal text-mkt-ash">/mo</span>
                </p>
              ) : (
                <p className="mt-4 font-poster text-5xl text-mkt-paper">Coming soon</p>
              )}
              <p className="mt-1 font-mono text-xs uppercase tracking-wider text-mkt-ash">
                Unlock full contact data
              </p>
              <ul className="mt-8 space-y-3 text-sm text-mkt-ash">
                <li className="flex gap-2">
                  <span className="text-mkt-signal">✓</span> Everything in Free
                </li>
                <li className="flex gap-2">
                  <span className="text-mkt-signal">✓</span> Full email addresses
                </li>
                <li className="flex gap-2">
                  <span className="text-mkt-signal">✓</span> CSV export with contacts
                </li>
                <li className="flex gap-2">
                  <span className="text-mkt-signal">✓</span> Priority support
                </li>
              </ul>
              {PAYMENTS_ENABLED ? (
                <Link href="/subscribe" className="mkt-btn-primary mt-8 w-full">
                  Subscribe now
                </Link>
              ) : (
                <p className="mt-8 w-full text-center font-mono text-xs uppercase tracking-wider text-mkt-ash">
                  Not available yet
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t mkt-hairline pb-24 pt-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="mx-auto max-w-3xl px-4 text-center"
        >
          <h2 className="mkt-h2">Ready to build your outreach list?</h2>
          <p className="mkt-body mx-auto mt-4 max-w-xl">
            Start with your enriched YouTube library, unlock emails when you are ready, and track
            outreach by list — not millions of profiles overnight.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/channels" className="mkt-btn-primary">
              Browse your database →
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="mkt-perforation border-t mkt-hairline py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 bg-mkt-ink px-4 py-4 md:flex-row">
          <BrandMark size="sm" variant="mkt" />
          <p className="font-mono text-xs uppercase tracking-wider text-mkt-ash">
            © {new Date().getFullYear()} {BRAND_NAME}. YouTube outreach for marketers.
          </p>
          <div className="flex flex-wrap justify-center gap-5 font-mono text-xs uppercase tracking-wider text-mkt-ash">
            <Link href="/channels" className="hover:text-mkt-paper">
              {DATA_SOURCE.database.label}
            </Link>
            <Link href="/privacy" className="hover:text-mkt-paper">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-mkt-paper">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-mkt-paper">
              Cookies
            </Link>
            <Link href="/youtubers" className="hover:text-mkt-paper">
              Creator lists
            </Link>
            <Link href="/tools" className="hover:text-mkt-paper">
              Free tools
            </Link>
            <Link href="/compare" className="hover:text-mkt-paper">
              Compare
            </Link>
            <Link href="/remove-my-listing" className="hover:text-mkt-paper">
              Creators: remove listing
            </Link>
            <Link href="/login" className="hover:text-mkt-paper">
              Sign in
            </Link>
            {PAYMENTS_ENABLED && (
              <Link href="/subscribe" className="hover:text-mkt-paper">
                Pricing
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}

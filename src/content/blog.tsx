/**
 * Blog articles. Numbers come from Influx's own scored-channel data
 * (snapshot: 25 November 2026, ~204,000 scored channels, ~9,800 passing).
 * Re-run the stats before changing any figure.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/blog/Prose";
import benchmarks from "@/data/engagement-benchmarks.json";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  published: string; // ISO date
  body: () => ReactNode;
}

const SNAPSHOT = "November 2026";

const NICHE_ENGAGEMENT: [string, number, number, number, number][] = [
  // niche, channels, p25 %, median %, p75 %
  ["Self-improvement", 156, 3.32, 4.67, 6.26],
  ["Podcast", 342, 3.01, 4.15, 6.23],
  ["Music", 940, 2.84, 3.9, 5.54],
  ["Sports", 586, 2.64, 3.55, 4.82],
  ["Beauty", 1226, 1.67, 3.26, 5.28],
  ["Personal finance", 876, 1.65, 3.14, 5.08],
  ["Gaming", 4356, 1.69, 3.05, 5.26],
  ["Lifestyle", 1946, 1.58, 2.95, 5.29],
  ["Food", 1889, 1.44, 2.86, 5.17],
  ["Business", 1953, 1.51, 2.76, 4.56],
  ["Fitness", 1159, 1.41, 2.74, 4.25],
  ["Parenting", 704, 1.27, 2.7, 5.01],
  ["Home & DIY", 589, 1.3, 2.66, 4.63],
  ["Travel", 1799, 1.39, 2.6, 4.47],
  ["Fashion", 1871, 1.39, 2.58, 4.61],
  ["Education", 3971, 1.28, 2.48, 4.35],
  ["Pets", 5973, 1.17, 2.3, 4.27],
  ["Entertainment", 6746, 1.18, 2.29, 4.15],
  ["Tech", 2289, 1.03, 1.94, 3.55],
];

const VIEWS_BY_TIER: [string, string, string, string][] = [
  // tier, median views as % of subs, median avg views, share under 5%
  ["1K–10K", "45.6%", "1,057", "13%"],
  ["10K–100K", "15.5%", "3,882", "30%"],
  ["100K–500K", "8.3%", "16,979", "39%"],
  ["500K–1M", "5.4%", "36,418", "48%"],
  ["1M+", "2.9%", "81,951", "60%"],
];

const pct = (n: number) => `${n.toFixed(2)}%`;

export const POSTS: BlogPost[] = [
  {
    slug: "youtube-engagement-rate-benchmarks",
    title: "YouTube Engagement Rate Benchmarks by Niche and Channel Size (2026)",
    description:
      "What a good YouTube engagement rate is in 2026: medians and ranges for 19 niches and 5 channel sizes, from nearly 40,000 channels.",
    published: "2026-11-25",
    body: () => (
      <>
        <p>
          &ldquo;Is 3% a good engagement rate?&rdquo; depends on the niche and the size of the channel. A 3% rate is
          below average for a podcast channel and well above average for a tech channel. Below are benchmarks
          from the channels Influx tracks, so you can compare a creator with others like them.
        </p>

        <h2>How engagement rate is calculated here</h2>
        <p>
          <strong>Engagement rate = (likes + comments) ÷ views</strong>, summed over a creator&apos;s last five
          uploads. We use views rather than subscribers because views measure the audience that actually saw the
          video. Subscriber-based rates mostly reward old channels with inactive subscribers.
        </p>
        <p>
          You can work out any channel&apos;s rate with our free{" "}
          <Link href="/tools/youtube-engagement-rate-calculator">engagement rate calculator</Link>.
        </p>

        <h2>Benchmarks by channel size</h2>
        <DataTable
          head={["Subscribers", "Channels", "Bottom quarter", "Median", "Top quarter"]}
          rows={benchmarks.tiers.map((t) => [t.label, t.sample.toLocaleString("en-US"), `${t.p25}%`, `${t.median}%`, `${t.p75}%`])}
          caption={`Influx data, ${SNAPSHOT}. "Bottom quarter" and "top quarter" are the 25th and 75th percentiles.`}
        />
        <p>
          Bigger channels have <em>higher</em> engagement per view in this data. One likely reason: large YouTube channels get fewer views per subscriber (see{" "}
          <Link href="/blog/youtube-subscribers-vs-views">our views-versus-subscribers analysis</Link>), so the
          people who do watch tend to be loyal fans who like and comment.
        </p>

        <h2>Benchmarks by niche</h2>
        <DataTable
          head={["Niche", "Channels", "Bottom quarter", "Median", "Top quarter"]}
          rows={NICHE_ENGAGEMENT.map(([n, c, a, b, d]) => [n, c.toLocaleString("en-US"), pct(a), pct(b), pct(d)])}
          caption={`Influx data, ${SNAPSHOT}. Channels with 1,000+ subscribers; niches with 150+ channels.`}
        />
        <ul>
          <li>
            <strong>Community niches lead.</strong> Self-improvement, podcasts and music audiences comment and
            like far more than average.
          </li>
          <li>
            <strong>Tech is lowest (1.94% median).</strong> People watch reviews and tutorials to decide, then
            leave. A 3% tech channel is in the top third of its niche.
          </li>
          <li>
            <strong>Entertainment and pets are low too.</strong> Their videos reach casual viewers who rarely
            interact.
          </li>
        </ul>

        <h2>How to use these numbers</h2>
        <ol>
          <li>Compare a creator with the same niche <em>and</em> size, not with an overall average.</li>
          <li>
            Treat a rate below the bottom quarter as a warning sign. Look at the comments for spam or generic
            replies.
          </li>
          <li>
            Treat a rate far above the top quarter with care too. Giveaways and &ldquo;comment to win&rdquo; videos
            inflate engagement for one upload.
          </li>
          <li>
            Engagement is only one check. Recent views and upload frequency matter more for what a sponsorship will
            deliver. See our <Link href="/blog/how-to-vet-a-youtube-creator">6-step creator vetting checklist</Link>.
          </li>
        </ol>

        <h2>About the data</h2>
        <p>
          Influx scores YouTube channels using public statistics from their last five uploads. Rates above 100%
          (broken counts) are excluded. Numbers are refreshed as channels are re-scored.
        </p>
      </>
    ),
  },
  {
    slug: "youtube-subscribers-vs-views",
    title: "Subscriber Count Is a Bad Way to Pick YouTubers: The Data",
    description:
      "60% of YouTube channels with 1M+ subscribers now average fewer views than 5% of their subscriber count. Here is what to look at instead.",
    published: "2026-11-25",
    body: () => (
      <>
        <p>
          Most influencer briefs still start with &ldquo;100K+ subscribers&rdquo;. We compared subscriber counts
          with the average views on each channel&apos;s last five videos across more than 120,000 channels. For
          predicting what a sponsorship will deliver, subscriber count turns out to be close to useless.
        </p>

        <h2>Recent views as a share of subscribers</h2>
        <DataTable
          head={["Subscribers", "Median views ÷ subs", "Median avg. views", "Under 5% of subs"]}
          rows={VIEWS_BY_TIER}
          caption={`Influx data, ${SNAPSHOT}. Average views over each channel's last five uploads.`}
        />
        <p>
          The typical channel with <strong>1M+ subscribers gets views from only 2.9%</strong> of that number on a
          new video, and <strong>60% of them stay under 5%</strong>. A small channel with 1K–10K subscribers
          typically reaches 45% of its subscriber count.
        </p>

        <h2>Why subscriber counts drift away from reality</h2>
        <ul>
          <li>
            <strong>Subscribers never expire.</strong> People who subscribed years ago still count, even if they
            no longer watch.
          </li>
          <li>
            <strong>YouTube recommends videos, not channels.</strong> Most views come from the home feed and
            search, so a video&apos;s reach depends on how it performs, not on how many subscribers the channel has.
          </li>
          <li>
            <strong>Channels change topic or stop.</strong> In our data, <strong>42% of channels</strong> had not
            uploaded in the last 45 days.
          </li>
        </ul>

        <h2>What to use instead</h2>
        <ol>
          <li>
            <strong>Average views on the last 5 videos.</strong> This is the closest estimate of what your
            sponsored video will get.
          </li>
          <li>
            <strong>Days since the last upload.</strong> Skip channels that have been quiet for more than 45 days.
          </li>
          <li>
            <strong>Engagement rate against niche benchmarks.</strong> See{" "}
            <Link href="/blog/youtube-engagement-rate-benchmarks">engagement benchmarks by niche</Link>.
          </li>
          <li>
            <strong>Price per expected view.</strong> Base the deal on recent views, not subscribers. Our{" "}
            <Link href="/tools/youtube-sponsorship-calculator">sponsorship calculator</Link> does this for you.
          </li>
        </ol>

        <h2>The opportunity for brands</h2>
        <p>
          Because the market still prices creators by subscribers, mid-size and smaller channels with strong
          recent views are often under-priced. Every list on{" "}
          <Link href="/youtubers">Influx&apos;s creator pages</Link> is filtered for recent uploads, 5,000+ average
          views and 2%+ engagement, so you start from creators who are delivering now.
        </p>
      </>
    ),
  },
  {
    slug: "how-to-vet-a-youtube-creator",
    title: "How to Vet a YouTube Creator Before a Sponsorship: 6 Checks",
    description:
      "A 10-minute checklist for brands: what to check on a YouTube channel before you pay for a sponsorship, with benchmarks from 200,000 channels.",
    published: "2026-11-25",
    body: () => (
      <>
        <p>
          Out of about 204,000 YouTube channels Influx has scored, <strong>fewer than 5% pass</strong> the basic
          checks below. Running these six checks before you send an offer takes about ten minutes per creator and
          filters out most bad deals.
        </p>

        <h2>1. They uploaded in the last 45 days</h2>
        <p>
          42% of the channels we scored had gone quiet for more than 45 days. A creator who is not posting
          regularly may deliver late, and the algorithm gives less reach to channels that post rarely.
        </p>

        <h2>2. Recent videos get real views</h2>
        <p>
          Average the views on the last five uploads, ignoring Shorts if you are buying a long-form integration.
          This number, not subscribers, predicts your result. 39% of the channels we scored failed our minimum-views
          check (5,000 average views for most niches). See{" "}
          <Link href="/blog/youtube-subscribers-vs-views">why subscriber count misleads</Link>.
        </p>

        <h2>3. Engagement is normal for their niche</h2>
        <p>
          Work out (likes + comments) ÷ views over the last five videos and compare it with{" "}
          <Link href="/blog/youtube-engagement-rate-benchmarks">benchmarks for the same niche</Link>. 27% of
          scored channels were under 2%. Very high spikes can come from giveaways rather than a loyal audience.
        </p>

        <h2>4. The comments are real</h2>
        <p>
          Read 20 comments on a recent video. Warning signs: generic praise (&ldquo;nice video!&rdquo;), the same
          accounts commenting on every upload, or comments that have nothing to do with the video.
        </p>

        <h2>5. The audience is in your market</h2>
        <p>
          Check the channel&apos;s country and language, and what the creator talks about (local prices, shipping,
          events). The country on the channel page is set by the creator and is not always where the audience
          lives. Ask for an audience-location screenshot from YouTube Studio before you sign.
        </p>

        <h2>6. Past sponsorships performed</h2>
        <p>
          Find their last two or three sponsored videos (search the channel for &ldquo;sponsored&rdquo; or
          &ldquo;use code&rdquo;). Did those videos get views close to the channel average, or noticeably fewer? Did
          the brand come back for a second deal?
        </p>

        <h2>Then agree a price on views</h2>
        <p>
          Base the fee on expected views (check 2) and the format. Our free{" "}
          <Link href="/tools/youtube-sponsorship-calculator">sponsorship price calculator</Link> gives a starting
          range.
        </p>
        <p>
          Influx does checks 1–3 automatically for creators in the US, UK and Europe. Browse{" "}
          <Link href="/youtubers">ranked creator lists by niche and country</Link>.
        </p>
      </>
    ),
  },
];

export function postBySlug(slug: string) {
  return POSTS.find((p) => p.slug === slug) ?? null;
}

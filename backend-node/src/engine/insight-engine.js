/**
 * Insight Engine — derive human-readable insights from processed analytics data.
 * Detects trends, surfaces wins/losses, and generates recommendations.
 */

function trend(val) {
  if (val === null || val === undefined) return "flat";
  const n = parseFloat(val);
  if (n > 10) return "up";
  if (n < -10) return "down";
  return "flat";
}

function arrow(val) {
  const t = trend(val);
  if (t === "up") return `▲ +${val}%`;
  if (t === "down") return `▼ ${val}%`;
  return `→ ${val || 0}%`;
}

function generateInsights(processed) {
  const insights = [];
  const g = processed.growth;
  const ov = processed.overview;
  const reach = processed.reach;
  const eng = processed.engagement;
  const aud = processed.audience;

  // ── Views ───────────────────────────────────────────────
  if (g.views?.vsPrev !== null) {
    const t = trend(g.views.vsPrev);
    insights.push({
      category: "Views",
      type: t === "up" ? "win" : t === "down" ? "loss" : "neutral",
      icon: t === "up" ? "📈" : t === "down" ? "📉" : "➡️",
      headline:
        t === "up"
          ? `Views grew ${arrow(g.views.vsPrev)} vs previous period`
          : t === "down"
          ? `Views dropped ${arrow(g.views.vsPrev)} vs previous period`
          : `Views remained stable ${arrow(g.views.vsPrev)}`,
      detail: `Current: ${ov.views.fmt} | Previous: ${ov.views.previous?.toLocaleString?.() || "N/A"}`,
      recommendation:
        t === "down"
          ? "Review upload frequency and thumbnail CTR. Consider SEO optimisation on underperforming videos."
          : "Maintain current content cadence. Double down on formats that drove this growth.",
    });
  }

  if (g.views?.vsYoY !== null) {
    insights.push({
      category: "Year-over-Year",
      type: trend(g.views.vsYoY) === "up" ? "win" : "loss",
      icon: "📅",
      headline: `Views ${arrow(g.views.vsYoY)} compared to same period last year`,
      detail: `YoY views: ${ov.views.yoy?.toLocaleString?.() || "N/A"}`,
      recommendation: parseFloat(g.views.vsYoY) > 0
        ? "Channel is growing year-over-year — sustain the momentum."
        : "Identify content or algorithm shifts that may have caused the annual decline.",
    });
  }

  // ── CTR ────────────────────────────────────────────────
  if (g.ctr?.vsPrev !== null) {
    const ctrT = trend(g.ctr.vsPrev);
    insights.push({
      category: "Click-Through Rate",
      type: ctrT === "up" ? "win" : "neutral",
      icon: "🎯",
      headline: `CTR ${arrow(g.ctr.vsPrev)} — current: ${reach.ctr.fmt}`,
      detail: `Impressions: ${reach.impressions.fmt}`,
      recommendation:
        ctrT === "down"
          ? "A/B test thumbnails. Revise titles for curiosity gaps. Review top-performing thumbnail styles."
          : "Continue using thumbnail styles that are working. Experiment with incremental improvements.",
    });
  }

  // ── Watch Time / Engagement ───────────────────────────
  if (g.avgViewDuration?.vsPrev !== null) {
    const durT = trend(g.avgViewDuration.vsPrev);
    insights.push({
      category: "Engagement",
      type: durT === "up" ? "win" : durT === "down" ? "loss" : "neutral",
      icon: durT === "up" ? "⏱️✅" : "⏱️",
      headline: `Avg view duration ${arrow(g.avgViewDuration.vsPrev)} — ${eng.avgViewDuration.fmt}`,
      detail: `Retention: ${eng.retention}`,
      recommendation:
        durT === "down"
          ? "Hook quality may have dropped. Audit first-30-second retention curves. Shorten intros."
          : "Strong retention signal — use this style across more content.",
    });
  }

  // ── Subscribers ───────────────────────────────────────
  if (g.subscribers?.vsPrev !== null) {
    const subT = trend(g.subscribers.vsPrev);
    insights.push({
      category: "Subscribers",
      type: subT === "up" ? "win" : "loss",
      icon: subT === "up" ? "👥✅" : "👥",
      headline: `Net subscribers ${arrow(g.subscribers.vsPrev)} this period`,
      detail: `Current subscriber count: ${ov.subscribers.fmt}`,
      recommendation:
        subT === "down"
          ? "Add strong CTAs within videos. Review which content attracts subscribers vs. browse visitors."
          : "Channel is adding subscribers. Nurture them with a welcome series or community post.",
    });
  }

  // ── Revenue ───────────────────────────────────────────
  if (g.revenue?.vsPrev !== null && ov.revenue.current > 0) {
    const revT = trend(g.revenue.vsPrev);
    insights.push({
      category: "Revenue",
      type: revT === "up" ? "win" : "loss",
      icon: "💰",
      headline: `Revenue ${arrow(g.revenue.vsPrev)} — ${ov.revenue.fmt}`,
      detail: "Ad revenue trend vs previous period",
      recommendation:
        revT === "down"
          ? "RPM may have dropped — consider sponsorships, memberships, or Super Thanks as alternatives."
          : "Revenue growth is healthy. Explore mid-roll ad placement optimisations.",
    });
  }

  // ── Top Content ───────────────────────────────────────
  const topVids = eng.topVideos || [];
  if (topVids.length > 0) {
    insights.push({
      category: "Top Content",
      type: "info",
      icon: "🏆",
      headline: `"${topVids[0]?.title || "Top video"}" led the period`,
      detail: `Views: ${topVids[0]?.views || "—"} | Watch time: ${topVids[0]?.watchTime || "—"}`,
      recommendation:
        "Create follow-up content to the top video. Identify the unique angle that resonated and replicate it.",
    });
  }

  // ── Audience ─────────────────────────────────────────
  const topCountry = aud.topCountries?.[0];
  if (topCountry?.country) {
    insights.push({
      category: "Audience Geography",
      type: "info",
      icon: "🌍",
      headline: `Primary audience: ${topCountry.country} (${topCountry.views} views)`,
      detail: `New viewers: ${aud.newViewers} | Returning: ${aud.returningViewers}`,
      recommendation:
        "Tailor content language and references to the dominant geography for increased resonance.",
    });
  }

  return insights;
}

module.exports = { generateInsights };

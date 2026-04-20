/**
 * Prompt Builder — Builds a structured data document for GenSpark.
 *
 * Strategy:
 *   - When API data is present → dump ALL metrics as a rich structured
 *     data report. No slide instructions. GenSpark reads the data and
 *     decides the layout.
 *   - When CSV advanced mode data is present → include the CSV blocks.
 *   - Legacy fallback → minimal text.
 */

function buildPrompt(extractedData, processedData, insights, reportConfig) {
  const { reportType, ranges } = reportConfig;

  // ── API data (new OAuth path) ────────────────────────────────
  if (extractedData?.channelId && extractedData?.current) {
    return buildAPIPrompt(extractedData, processedData, reportConfig);
  }

  // ── CSV advanced mode ────────────────────────────────────────
  if (extractedData?.advancedMode && extractedData?.breakdowns) {
    return buildCSVPrompt(extractedData, reportConfig);
  }

  // ── Legacy fallback ──────────────────────────────────────────
  return buildLegacyPrompt(extractedData, processedData, insights, reportConfig);
}

/* ═══════════════════════════════════════════════════════════════
   API-BASED DATA DUMP (OAuth path — new primary mode)
   No slide instructions. Pure data. GenSpark decides the format.
═══════════════════════════════════════════════════════════════ */
function buildAPIPrompt(raw, proc, reportConfig) {
  const { reportType, ranges } = reportConfig;
  const { current: cur, previous: prev, yoy } = ranges;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const A = raw.current  || {};
  const B = raw.previous || {};
  const C = raw.yoy      || {};
  const G = proc?.growth || {};

  const n  = v => (v !== undefined && v !== null && v !== "") ? v : "—";
  const pn = v => (v !== undefined && v !== null && v !== "") ? (v > 0 ? `+${v}%` : `${v}%`) : "—";
  const money = v => (v && v !== 0) ? `$${Number(v).toFixed(2)}` : "—";
  const mins  = v => v ? `${Math.round(v / 60).toLocaleString()} hr ${Math.round(v % 60)} min` : "—";
  const dur   = s => s ? `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}` : "—";
  const pct   = v => v ? `${Number(v).toFixed(1)}%` : "—";

  // Helper: render a breakdown table from rowsToArray output
  function table(rows, label1 = "Category", label2 = "Views", label3 = null, maxRows = 15) {
    if (!rows || rows.length === 0) return "  (no data)\n";
    const out = [];
    const header = label3 ? `  ${label1.padEnd(35)} ${label2.padEnd(15)} ${label3}` : `  ${label1.padEnd(35)} ${label2}`;
    out.push(header);
    out.push("  " + "─".repeat(header.length - 2));
    for (const r of rows.slice(0, maxRows)) {
      const row = label3
        ? `  ${String(r.label).padEnd(35)} ${String(n(r.value)).padEnd(15)} ${n(r.value2)}`
        : `  ${String(r.label).padEnd(35)} ${n(r.value)}`;
      out.push(row);
    }
    return out.join("\n") + "\n";
  }

  // Helper: render top videos table
  function topVideosTable(videos, maxRows = 10) {
    if (!videos || videos.length === 0) return "  (no data)\n";
    const out = [];
    out.push(`  ${"#".padEnd(4)} ${"Title".padEnd(50)} ${"Views".padEnd(12)} ${"Watch Time (min)".padEnd(20)} Avg Duration`);
    out.push("  " + "─".repeat(105));
    videos.slice(0, maxRows).forEach((v, i) => {
      const title = (v.title || v.id || "").slice(0, 48);
      out.push(`  ${String(i + 1).padEnd(4)} ${title.padEnd(50)} ${String(n(v.views)).padEnd(12)} ${String(n(v.estimatedMinutesWatched)).padEnd(20)} ${dur(v.averageViewDuration)}`);
    });
    return out.join("\n") + "\n";
  }

  const prompt = `
YouTube Channel Analytics — Full Data Report
Channel: ${raw.channelTitle || "—"} (${raw.channelId || "—"})
Report Type: ${(reportType || "CUSTOM").toUpperCase()}
Generated: ${date}

Current Period:  ${cur?.start}  →  ${cur?.end}
Previous Period: ${prev?.start}  →  ${prev?.end}
Year-over-Year:  ${yoy?.start}  →  ${yoy?.end}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1 — OVERVIEW METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Metric                          Current          Previous         YoY             Growth vs Prev   Growth vs YoY
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Views                           ${String(n(A.overview?.views)).padEnd(16)} ${String(n(B.overview?.views)).padEnd(16)} ${String(n(C.overview?.views)).padEnd(15)} ${String(pn(G.views?.vsPrev)).padEnd(16)} ${pn(G.views?.vsYoY)}
Watch Time (minutes)            ${String(n(A.overview?.watchTime)).padEnd(16)} ${String(n(B.overview?.watchTime)).padEnd(16)} ${String(n(C.overview?.watchTime)).padEnd(15)} ${pn(G.watchTime?.vsPrev)}
Avg View Duration               ${String(dur(A.overview?.averageViewDuration)).padEnd(16)} ${String(dur(B.overview?.averageViewDuration)).padEnd(16)} ${dur(C.overview?.averageViewDuration)}
Avg % Viewed                    ${String(pct(A.overview?.averageViewPercentage)).padEnd(16)} ${pct(B.overview?.averageViewPercentage)}
Subscribers Gained              ${String(n(A.overview?.subscribersGained)).padEnd(16)} ${String(n(B.overview?.subscribersGained)).padEnd(16)} ${n(C.overview?.subscribersGained)}
Subscribers Lost                ${String(n(A.overview?.subscribersLost)).padEnd(16)} ${n(B.overview?.subscribersLost)}
Net Subscribers                 ${String(n(A.overview?.netSubscribers)).padEnd(16)} ${String(n(B.overview?.netSubscribers)).padEnd(16)} ${n(C.overview?.netSubscribers)}
Likes                           ${String(n(A.overview?.likes)).padEnd(16)} ${n(B.overview?.likes)}
Dislikes                        ${String(n(A.overview?.dislikes)).padEnd(16)} ${n(B.overview?.dislikes)}
Shares                          ${String(n(A.overview?.shares)).padEnd(16)} ${n(B.overview?.shares)}
Comments                        ${String(n(A.overview?.comments)).padEnd(16)} ${n(B.overview?.comments)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2 — MONETIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Metric                          Current          Previous
──────────────────────────────────────────────────────────
Estimated Revenue               ${String(money(A.monetization?.estimatedRevenue)).padEnd(16)} ${money(B.monetization?.estimatedRevenue)}
Estimated Ad Revenue            ${String(money(A.monetization?.estimatedAdRevenue)).padEnd(16)} ${money(B.monetization?.estimatedAdRevenue)}
Gross Revenue                   ${String(money(A.monetization?.grossRevenue)).padEnd(16)} ${money(B.monetization?.grossRevenue)}
YouTube Premium Revenue         ${String(money(A.monetization?.premiumRevenue)).padEnd(16)} ${money(B.monetization?.premiumRevenue)}
Monetized Playbacks             ${String(n(A.monetization?.monetizedPlaybacks)).padEnd(16)} ${n(B.monetization?.monetizedPlaybacks)}
Playback-based CPM              ${String(money(A.monetization?.playbackBasedCpm)).padEnd(16)} ${money(B.monetization?.playbackBasedCpm)}

YouTube Premium Views           ${String(n(A.premium?.premiumViews)).padEnd(16)} ${n(B.premium?.premiumViews)}
YouTube Premium Watch Time      ${String(n(A.premium?.premiumWatchTime)).padEnd(16)} ${n(B.premium?.premiumWatchTime)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3 — CARDS & END SCREENS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CARDS (Current Period)
  Card Impressions:         ${n(A.cards?.cardImpressions)}
  Card Clicks:              ${n(A.cards?.cardClicks)}
  Click Rate:               ${pct(A.cards?.cardClickRate)}
  Teaser Impressions:       ${n(A.cards?.cardTeaserImpressions)}
  Teaser Clicks:            ${n(A.cards?.cardTeaserClicks)}
  Teaser Click Rate:        ${pct(A.cards?.cardTeaserClickRate)}

Card Types:
${table(A.cardType, "Card Type", "Clicks")}

END SCREENS (Current Period)
  Impressions:              ${n(A.endScreens?.impressions)}
  Clicks:                   ${n(A.endScreens?.clicks)}
  Click Rate:               ${pct(A.endScreens?.clickRate)}

End Screen Element Types:
${table(A.endScreenType, "Element Type", "Clicks")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4 — TRAFFIC SOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Traffic Source              Current Views    Watch Time (min)
${table(A.trafficSource, "Source", "Views", "Watch Time")}

Previous Period:
${table(B.trafficSource, "Source", "Views", "Watch Time")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5 — GEOGRAPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Top Countries (Current Period):
${table(A.geography, "Country", "Views", "Watch Time")}

Top Cities / Provinces (Current Period):
${table(A.cities, "City/Province", "Views")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 6 — AUDIENCE DEMOGRAPHICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Viewer Age & Gender (% of views):
${table(A.viewerAge, "Age Group", "% Viewers")}

Viewer Gender Distribution:
${Object.entries(A.viewerGender || {}).map(([g, v]) => `  ${g.padEnd(15)} ${v}%`).join("\n") || "  (no data)"}

New vs Returning Viewers:
${table(A.newAndReturning, "Viewer Type", "Views", "Watch Time")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 7 — SUBSCRIPTION & ENGAGEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subscription Status:
${table(A.subscriptionStatus, "Status", "Views", "Watch Time")}

Subscription Source (Gained / Lost):
${table(A.subscriptionSource, "Source", "Gained", "Lost")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 8 — DEVICE & PLATFORM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Device Type:
${table(A.deviceType, "Device", "Views", "Watch Time")}

Operating System:
${table(A.operatingSystem, "OS", "Views")}

YouTube Product:
${table(A.youtubeProduct, "Product", "Views")}

Playback Location:
${table(A.playbackLocation, "Location", "Views")}

Sharing Service:
${table(A.sharingService, "Service", "Shares")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 9 — CONTENT TYPE & LANGUAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Content Type (Live vs On-Demand):
${table(A.contentType, "Type", "Views", "Watch Time")}

Subtitles / CC Usage:
${table(A.subtitles, "Language", "Views")}

Video Info Language:
${table(A.videoInfoLanguage, "Language", "Views")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 10 — PLAYLISTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${(A.playlists || []).length === 0 ? "  (no playlist data)" : (A.playlists || []).slice(0, 15).map((p, i) => {
  return `  ${i+1}. ${(p.title || p.id || "").slice(0, 55)}\n     Views: ${n(p.views)}   Playlist Starts: ${n(p.playlistStarts)}   Avg Time: ${n(p.averageTimeInPlaylist)}min   Saves: ${n(p.playlistSaveRate)}`;
}).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 11 — TOP PERFORMING VIDEOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${topVideosTable(A.topVideos)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 12 — TIME SERIES (DAILY BREAKDOWN, CURRENT PERIOD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Date         Views       Watch Time    Subscribers
──────────────────────────────────────────────────
${(A.timeSeries || []).map(d => `${d.date}   ${String(n(d.views)).padEnd(11)} ${String(n(d.watchTime)).padEnd(14)} ${n(d.subscribers)}`).join("\n") || "  (no data)"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 13 — YEAR-OVER-YEAR COMPARISON (KEY METRICS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Metric                     YoY Period           Value
──────────────────────────────────────────────────────
Views                      ${yoy?.start}–${yoy?.end}    ${n(C.overview?.views)}
Watch Time (min)           ${yoy?.start}–${yoy?.end}    ${n(C.overview?.watchTime)}
Subscribers Gained                               ${n(C.overview?.subscribersGained)}
Subscribers Lost                                 ${n(C.overview?.subscribersLost)}
Revenue                                          ${money(C.monetization?.estimatedRevenue)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRESENTATION INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Based on the extensive, highly-detailed YouTube Analytics data provided above, please create a comprehensive, deeply analytical presentation.

CRITICAL REQUIREMENT: Create a detailed report over 20 slides.

The presentation should be a highly professional deep-dive covering every aspect of the channel's performance, including:
- Executive Summary & High-level KPIs
- Extensive Content Performance & Top Videos Analysis
- Comprehensive Audience Demographics & Geography
- Deep dive into Traffic Sources & Viewer Discovery
- Engagement breakdown (Likes, Comments, Shares)
- Device & Platform usage insights
- Strategic Recommendations & Actionable Next Steps

Please use a sophisticated, professional dark theme with sleek YouTube Red accents.
`.trim();

  return prompt;
}


/* ═══════════════════════════════════════════════════════════════
   CSV-BASED PROMPT (Advanced/CSV mode — kept as-is)
═══════════════════════════════════════════════════════════════ */
function buildCSVPrompt(extractedData, reportConfig) {
  const { reportType, ranges } = reportConfig;
  const { current, previous, yoy } = ranges;
  const { breakdowns, downloadedCount } = extractedData;

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  let dataBlock = "";
  for (const periodKey of ["current", "previous", "yoy"]) {
    const periodData = breakdowns[periodKey];
    if (!periodData) continue;
    dataBlock += `\n######################################################\n`;
    dataBlock += `### PERIOD: ${periodKey.toUpperCase()} (${ranges[periodKey]?.start || "N/A"} to ${ranges[periodKey]?.end || "N/A"}) ###\n`;
    dataBlock += `######################################################\n`;
    for (const [breakdown, csvContent] of Object.entries(periodData)) {
      if (!csvContent || csvContent.trim().length < 5) continue;
      dataBlock += `\n--- BREAKDOWN: ${breakdown.toUpperCase()} ---\n`;
      const truncated = csvContent.slice(0, 2000);
      dataBlock += truncated;
      if (csvContent.length > 2000) dataBlock += "\n...[truncated]";
      dataBlock += "\n";
    }
  }

  return `YouTube Channel Analytics — Full Data Report
Report Type: ${(reportType || "CUSTOM").toUpperCase()}
Current Period:  ${current?.start} → ${current?.end}
Previous Period: ${previous?.start} → ${previous?.end}
Year-over-Year:  ${yoy?.start} → ${yoy?.end}
Generated: ${date}
Data Categories: ${downloadedCount || "Multiple"} exports

${dataBlock}`.trim();
}


/* ═══════════════════════════════════════════════════════════════
   LEGACY FALLBACK
═══════════════════════════════════════════════════════════════ */
function buildLegacyPrompt(extractedData, processedData, insights, reportConfig) {
  const { reportType, ranges } = reportConfig;
  const { current, previous, yoy } = ranges;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const fmt = v => (v != null && v !== "") ? v : "N/A";
  const curr = extractedData?.current  || {};
  const proc = processedData           || {};

  return `YouTube Channel Analytics Report
Report Type: ${(reportType || "CUSTOM").toUpperCase()}
Period: ${current?.start} → ${current?.end}
Previous: ${previous?.start} → ${previous?.end}
YoY: ${yoy?.start} → ${yoy?.end}
Generated: ${date}

OVERVIEW
Views:              ${fmt(curr.overview?.views)}
Watch Time (min):   ${fmt(curr.overview?.watchTime)}
Avg View Duration:  ${fmt(curr.overview?.averageViewDuration)}s
Avg % Viewed:       ${fmt(curr.overview?.averageViewPercentage)}%
Subscribers Gained: ${fmt(curr.overview?.subscribersGained)}
Subscribers Lost:   ${fmt(curr.overview?.subscribersLost)}
Likes:              ${fmt(curr.overview?.likes)}
Shares:             ${fmt(curr.overview?.shares)}
Comments:           ${fmt(curr.overview?.comments)}

GROWTH VS PREVIOUS
Views:         ${fmt(proc.growth?.views?.vsPrev)}%
Watch Time:    ${fmt(proc.growth?.watchTime?.vsPrev)}%
Subscribers:   ${fmt(proc.growth?.netSubscribers?.vsPrev)}%`.trim();
}


module.exports = { buildPrompt };

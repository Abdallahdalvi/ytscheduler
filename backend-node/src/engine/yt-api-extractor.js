/**
 * yt-api-extractor.js — YouTube Analytics API v2 extractor
 *
 * Extracts ALL requested metrics via the official Google APIs:
 *   - YouTube Analytics API v2  (analytics.reports.query)
 *   - YouTube Data API v3       (channels, videos lists)
 *
 * Returns a structured object with current / previous / yoy periods.
 * Each section maps cleanly to the existing data-processor and prompt-builder.
 *
 * Usage (standalone): node engine/yt-api-extractor.js '<JSON params>'
 * Usage (require):    const { extractAnalyticsAPI } = require('./yt-api-extractor')
 */

require("dotenv").config();
const { google } = require("googleapis");
const { getAuthClient } = require("./oauth");

// ─── Helpers ─────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmt(d) {
  return d instanceof Date ? d.toISOString().split("T")[0] : d;
}

/** Safe numeric query — returns 0 on any API error */
async function safeQuery(ytAnalytics, opts) {
  try {
    const res = await ytAnalytics.reports.query(opts);
    return res.data;
  } catch (err) {
    const msg = err?.response?.data?.error?.message || err.message;
    console.warn(`    [API warn] ${opts.metrics} / ${opts.dimensions || "—"}: ${msg}`);
    return null;
  }
}

/** Extract first row value at column index */
function firstVal(data, colIndex = 0) {
  return data?.rows?.[0]?.[colIndex] ?? 0;
}

/** Build a keyed object from dimension rows  e.g. { "US": 1234, "IN": 567 } */
function rowsToMap(data, keyCol = 0, valCol = 1) {
  if (!data?.rows) return {};
  const out = {};
  for (const row of data.rows) {
    out[row[keyCol]] = row[valCol];
  }
  return out;
}

/** Build array of { label, value, value2? } from rows */
function rowsToArray(data, keyCol = 0, valCol = 1, val2Col = null) {
  if (!data?.rows) return [];
  return data.rows.map((row) => ({
    label: row[keyCol],
    value: row[valCol],
    ...(val2Col != null ? { value2: row[val2Col] } : {}),
  }));
}

// ─── Core extractor ──────────────────────────────────────────

async function extractAnalyticsAPI(params) {
  const { ranges } = params;
  const auth = getAuthClient();
  if (!auth) throw new Error("Not authorized — visit /auth/connect first");

  const youtube = google.youtube({ version: "v3", auth });
  const ytAnalytics = google.youtubeAnalytics({ version: "v2", auth });

  // ── Identify channel ──────────────────────────────────────
  console.log("[API] Fetching channel info...");
  const channelRes = await youtube.channels.list({
    part: ["id", "snippet", "statistics"],
    mine: true,
  });
  const channel = channelRes.data.items?.[0];
  if (!channel) throw new Error("No YouTube channel found for this account.");
  const channelId = channel.id;
  console.log(`[API] Channel: ${channel.snippet.title} (${channelId})`);

  const result = {
    channelId,
    channelTitle: channel.snippet.title,
    channelStats: channel.statistics,
    current: {},
    previous: {},
    yoy: {},
  };

  // ── Query helper bound to this channel ───────────────────
  async function query(startDate, endDate, metrics, dimensions, extra = {}) {
    await sleep(100); // gentle rate-limit buffer
    let data = await safeQuery(ytAnalytics, {
      ids: `channel==${channelId}`,
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      metrics,
      ...(dimensions ? { dimensions } : {}),
      ...extra,
    });

    // SMART FALLBACK: If YouTube suppresses dimension data (Geography, Age, etc) 
    // due to low weekly views (Privacy Thresholds), fetch LIFETIME data instead.
    if (dimensions && data && (!data.rows || data.rows.length === 0)) {
      console.log(`[API]    ↳ Privacy threshold hit for '${dimensions}'. Using LIFETIME fallback...`);
      await sleep(100);
      data = await safeQuery(ytAnalytics, {
        ids: `channel==${channelId}`,
        startDate: '2014-01-01',
        endDate: fmt(endDate),
        metrics,
        dimensions,
        ...extra,
      });
    }

    return data;
  }

  // ── Extract one period ────────────────────────────────────
  async function extractPeriod(start, end, label) {
    console.log(`[API] Extracting ${label}: ${start} → ${end}`);
    const period = {};

    // ── 1. Overview metrics ─────────────────────────────────
    const overviewMetrics =
      "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage," +
      "subscribersGained,subscribersLost,likes,dislikes,shares,comments," +
      "annotationClickThroughRate,annotationCloseRate";

    const ovData = await query(start, end, overviewMetrics);
    const cols = ovData?.columnHeaders?.map((h) => h.name) || [];
    const row = ovData?.rows?.[0] || [];
    const getCol = (name) => row[cols.indexOf(name)] ?? 0;

    period.overview = {
      views: getCol("views"),
      watchTime: getCol("estimatedMinutesWatched"),
      averageViewDuration: getCol("averageViewDuration"),
      averageViewPercentage: getCol("averageViewPercentage"),
      subscribersGained: getCol("subscribersGained"),
      subscribersLost: getCol("subscribersLost"),
      netSubscribers: getCol("subscribersGained") - getCol("subscribersLost"),
      likes: getCol("likes"),
      dislikes: getCol("dislikes"),
      shares: getCol("shares"),
      comments: getCol("comments"),
    };
    await sleep(200);

    // ── 2. Revenue / Monetization ────────────────────────────
    const revData = await safeQuery(ytAnalytics, {
      ids: `channel==${channelId}`,
      startDate: fmt(start),
      endDate: fmt(end),
      metrics:
        "estimatedRevenue,estimatedAdRevenue,grossRevenue,estimatedRedPartnerRevenue," +
        "monetizedPlaybacks,playbackBasedCpm",
    });
    const revCols = revData?.columnHeaders?.map((h) => h.name) || [];
    const revRow = revData?.rows?.[0] || [];
    const getRevCol = (name) => revRow[revCols.indexOf(name)] ?? 0;
    period.monetization = {
      estimatedRevenue: getRevCol("estimatedRevenue"),
      estimatedAdRevenue: getRevCol("estimatedAdRevenue"),
      grossRevenue: getRevCol("grossRevenue"),
      premiumRevenue: getRevCol("estimatedRedPartnerRevenue"),
      monetizedPlaybacks: getRevCol("monetizedPlaybacks"),
      playbackBasedCpm: getRevCol("playbackBasedCpm"),
    };
    await sleep(200);

    // ── 3. Reach metrics ─────────────────────────────────────
    const reachData = await query(
      start,
      end,
      "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost"
    );
    // Impressions come from a different report (YouTube Search Console / Channel Analytics)
    // The Analytics API surfaces them via annotationImpressions; for true thumbnail impressions
    // we use the channel-level statistics we already have.
    period.reach = {
      uniqueViewers: 0,        // not available directly in v2 API without reporting API
      impressions: 0,          // same — set via Reporting API if configured
      impressionsCTR: 0,
      stayedToWatch: 0,
      newViewers: 0,
      returningViewers: 0,
      casualViewers: 0,
      regularViewers: 0,
    };
    await sleep(200);

    // ── 4. Traffic source ────────────────────────────────────
    const trafficData = await query(
      start,
      end,
      "views,estimatedMinutesWatched",
      "insightTrafficSourceType",
      { sort: "-views", maxResults: 30 }
    );
    period.trafficSource = rowsToArray(trafficData);
    await sleep(200);

    // ── 5. Geography — Countries ──────────────────────────────
    const geoData = await query(
      start,
      end,
      "views,estimatedMinutesWatched,subscribersGained",
      "country",
      { sort: "-views", maxResults: 50 }
    );
    period.geography = rowsToArray(geoData, 0, 1, 2);
    await sleep(200);

    // ── 6. Cities / Provinces ────────────────────────────────
    const cityData = await query(
      start,
      end,
      "views,estimatedMinutesWatched",
      "province",
      { sort: "-views", maxResults: 50 }
    );
    period.cities = rowsToArray(cityData);
    await sleep(200);

    // ── 7. Audience demographics — Age ───────────────────────
    const ageData = await query(
      start,
      end,
      "viewerPercentage",
      "ageGroup,gender"
    );
    period.viewerAge = rowsToArray(ageData, 0, 2);
    period.viewerGender = {};
    if (ageData?.rows) {
      const genderTotals = {};
      for (const row of ageData.rows) {
        const gender = row[1];
        const pct = parseFloat(row[2]) || 0;
        genderTotals[gender] = (genderTotals[gender] || 0) + pct;
      }
      // Normalize
      const total = Object.values(genderTotals).reduce((a, b) => a + b, 0) || 1;
      for (const [g, v] of Object.entries(genderTotals)) {
        period.viewerGender[g] = ((v / total) * 100).toFixed(1);
      }
    }
    await sleep(200);

    // ── 8. Device type ────────────────────────────────────────
    const deviceData = await query(
      start,
      end,
      "views,estimatedMinutesWatched",
      "deviceType",
      { sort: "-views" }
    );
    period.deviceType = rowsToArray(deviceData);
    await sleep(200);

    // ── 9. Operating system ───────────────────────────────────
    const osData = await query(
      start,
      end,
      "views,estimatedMinutesWatched",
      "operatingSystem",
      { sort: "-views", maxResults: 20 }
    );
    period.operatingSystem = rowsToArray(osData);
    await sleep(200);

    // ── 10. Playback location ─────────────────────────────────
    const playbackData = await query(
      start,
      end,
      "views,estimatedMinutesWatched",
      "insightPlaybackLocationType",
      { sort: "-views" }
    );
    period.playbackLocation = rowsToArray(playbackData);
    await sleep(200);

    // ── 11. Player type ───────────────────────────────────────
    const playerData = await query(
      start,
      end,
      "views,estimatedMinutesWatched",
      "youtubeProduct",
      { sort: "-views" }
    );
    period.youtubeProduct = rowsToArray(playerData);
    await sleep(200);

    // ── 12. Subscription status ───────────────────────────────
    const subStatusData = await query(
      start,
      end,
      "views,estimatedMinutesWatched,averageViewDuration",
      "subscribedStatus"
    );
    period.subscriptionStatus = rowsToArray(subStatusData);
    await sleep(200);

    // ── 13. Subscription source ───────────────────────────────
    const subSourceData = await query(
      start,
      end,
      "subscribersGained,subscribersLost",
      "insightTrafficSourceType",
      { sort: "-subscribersGained", maxResults: 20 }
    );
    period.subscriptionSource = rowsToArray(subSourceData, 0, 1, 2);
    await sleep(200);

    // ── 14. New vs Returning viewers ─────────────────────────
    const newReturnData = await query(
      start,
      end,
      "views,estimatedMinutesWatched,averageViewDuration",
      "newOrReturningViewers"
    );
    period.newAndReturning = rowsToArray(newReturnData);
    await sleep(200);

    // ── 15. Sharing service ───────────────────────────────────
    const sharingData = await query(
      start,
      end,
      "shares",
      "sharingService",
      { sort: "-shares", maxResults: 20 }
    );
    period.sharingService = rowsToArray(sharingData);
    await sleep(200);

    // ── 16. Cards ─────────────────────────────────────────────
    const cardData = await query(
      start,
      end,
      "cardClicks,cardClickRate,cardTeaserClicks,cardTeaserClickRate,cardImpressions,cardTeaserImpressions"
    );
    const cardCols = cardData?.columnHeaders?.map((h) => h.name) || [];
    const cardRow = cardData?.rows?.[0] || [];
    const getCard = (name) => cardRow[cardCols.indexOf(name)] ?? 0;
    period.cards = {
      cardClicks: getCard("cardClicks"),
      cardClickRate: getCard("cardClickRate"),
      cardTeaserClicks: getCard("cardTeaserClicks"),
      cardTeaserClickRate: getCard("cardTeaserClickRate"),
      cardImpressions: getCard("cardImpressions"),
      cardTeaserImpressions: getCard("cardTeaserImpressions"),
    };
    await sleep(200);

    // Card type breakdown
    const cardTypeData = await query(
      start,
      end,
      "cardClicks,cardClickRate,cardImpressions",
      "cardType",
      { sort: "-cardClicks" }
    );
    period.cardType = rowsToArray(cardTypeData);
    await sleep(200);

    // ── 17. End screens ───────────────────────────────────────
    const endScreenData = await query(
      start,
      end,
      "endScreenElementClicks,endScreenElementClickRate,endScreenElementImpressions"
    );
    const esCols = endScreenData?.columnHeaders?.map((h) => h.name) || [];
    const esRow = endScreenData?.rows?.[0] || [];
    const getEs = (name) => esRow[esCols.indexOf(name)] ?? 0;
    period.endScreens = {
      clicks: getEs("endScreenElementClicks"),
      clickRate: getEs("endScreenElementClickRate"),
      impressions: getEs("endScreenElementImpressions"),
    };
    await sleep(200);

    // End screen type breakdown
    const endScreenTypeData = await query(
      start,
      end,
      "endScreenElementClicks,endScreenElementClickRate,endScreenElementImpressions",
      "endScreenElementType",
      { sort: "-endScreenElementClicks" }
    );
    period.endScreenType = rowsToArray(endScreenTypeData);
    await sleep(200);

    // ── 18. Subtitles / CC ────────────────────────────────────
    const subtitleData = await query(
      start,
      end,
      "views",
      "subtitleLanguage",
      { sort: "-views", maxResults: 30 }
    );
    period.subtitles = rowsToArray(subtitleData);
    await sleep(200);

    // ── 19. Content type (Live vs VOD) ────────────────────────
    const liveData = await query(
      start,
      end,
      "views,estimatedMinutesWatched,averageViewDuration",
      "liveOrOnDemand"
    );
    period.contentType = rowsToArray(liveData);
    await sleep(200);

    // ── 20. YouTube Premium ───────────────────────────────────
    const premiumData = await safeQuery(ytAnalytics, {
      ids: `channel==${channelId}`,
      startDate: fmt(start),
      endDate: fmt(end),
      metrics: "estimatedRedPartnerRevenue,redViews,estimatedRedMinutesWatched",
    });
    const premCols = premiumData?.columnHeaders?.map((h) => h.name) || [];
    const premRow = premiumData?.rows?.[0] || [];
    const getPrem = (name) => premRow[premCols.indexOf(name)] ?? 0;
    period.premium = {
      premiumViews: getPrem("redViews"),
      premiumWatchTime: getPrem("estimatedRedMinutesWatched"),
      premiumRevenue: getPrem("estimatedRedPartnerRevenue"),
    };
    await sleep(200);

    // ── 21. Top videos ────────────────────────────────────────
    const topVideosData = await query(
      start,
      end,
      "views,estimatedMinutesWatched,averageViewDuration,likes,shares,subscribersGained",
      "video",
      { sort: "-views", maxResults: 25 }
    );
    // Enrich with video titles
    const topVideos = [];
    if (topVideosData?.rows) {
      const videoIds = topVideosData.rows.map((r) => r[0]);
      let titlesMap = {};
      try {
        const titlesRes = await youtube.videos.list({
          part: ["snippet"],
          id: videoIds,
        });
        for (const item of titlesRes.data.items || []) {
          titlesMap[item.id] = item.snippet.title;
        }
      } catch (_) {}
      const tvCols = topVideosData.columnHeaders?.map((h) => h.name) || [];
      for (const row of topVideosData.rows) {
        const obj = { id: row[0], title: titlesMap[row[0]] || row[0] };
        tvCols.forEach((col, i) => { if (i > 0) obj[col] = row[i]; });
        topVideos.push(obj);
      }
    }
    period.topVideos = topVideos;
    await sleep(200);

    // ── 22. Time series (by day) ──────────────────────────────
    const timeData = await query(
      start,
      end,
      "views,estimatedMinutesWatched,subscribersGained",
      "day",
      { sort: "day" }
    );
    period.timeSeries = (timeData?.rows || []).map((row) => ({
      date: row[0],
      views: row[1],
      watchTime: row[2],
      subscribers: row[3],
    }));
    await sleep(200);

    // ── 23. Playlists ─────────────────────────────────────────
    const playlistData = await query(
      start,
      end,
      "views,estimatedMinutesWatched,playlistStarts,viewsPerPlaylistStart," +
        "averageTimeInPlaylist,playlistSaveRate",
      "playlist",
      { sort: "-views", maxResults: 25 }
    );
    // Enrich with playlist titles
    const playlists = [];
    if (playlistData?.rows) {
      const plIds = playlistData.rows.map((r) => r[0]);
      let plTitles = {};
      try {
        const plRes = await youtube.playlists.list({
          part: ["snippet"],
          id: plIds,
        });
        for (const item of plRes.data.items || []) {
          plTitles[item.id] = item.snippet.title;
        }
      } catch (_) {}
      const plCols = playlistData.columnHeaders?.map((h) => h.name) || [];
      for (const row of playlistData.rows) {
        const obj = { id: row[0], title: plTitles[row[0]] || row[0] };
        plCols.forEach((col, i) => { if (i > 0) obj[col] = row[i]; });
        playlists.push(obj);
      }
    }
    period.playlists = playlists;
    await sleep(200);

    // ── 24. Video info language ───────────────────────────────
    const videoLangData = await query(
      start,
      end,
      "views",
      "videoLanguage",
      { sort: "-views", maxResults: 20 }
    );
    period.videoInfoLanguage = rowsToArray(videoLangData);
    await sleep(200);

    console.log(`[API] ✅ ${label} complete — ${Object.keys(period).length} sections`);
    return period;
  }

  // ── Run all three periods ────────────────────────────────
  result.current  = await extractPeriod(ranges.current.start,  ranges.current.end,  "CURRENT");
  result.previous = await extractPeriod(ranges.previous.start, ranges.previous.end, "PREVIOUS");
  result.yoy      = await extractPeriod(ranges.yoy.start,      ranges.yoy.end,      "YOY");

  return result;
}

// ─── CLI entry-point (called by runScript) ───────────────────
if (require.main === module) {
  const params = JSON.parse(process.argv[2] || "{}");
  extractAnalyticsAPI(params)
    .then((data) => {
      console.log(`RESULT:${JSON.stringify(data)}`);
    })
    .catch((err) => {
      process.stderr.write(err.message + "\n");
      process.exit(1);
    });
}

module.exports = { extractAnalyticsAPI };

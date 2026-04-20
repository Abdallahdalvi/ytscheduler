/**
 * Data Processor — converts raw API data to processed metrics,
 * calculates growth percentages and period-over-period deltas.
 * Compatible with both legacy scraper output and new API output.
 */

function safeNum(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, "").trim();
  if (/K$/i.test(cleaned)) return parseFloat(cleaned) * 1_000;
  if (/M$/i.test(cleaned)) return parseFloat(cleaned) * 1_000_000;
  if (/B$/i.test(cleaned)) return parseFloat(cleaned) * 1_000_000_000;
  if (/%$/.test(cleaned)) return parseFloat(cleaned);
  const num = parseFloat(cleaned.replace(/[^0-9.\-]/g, "")) || 0;
  return num;
}

function pctChange(current, previous) {
  if (!previous || previous === 0) return null;
  return (((current - previous) / Math.abs(previous)) * 100).toFixed(1);
}

function fmt(n) {
  if (n == null) return "N/A";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(Math.round(n));
}

function fmtDuration(seconds) {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtPct(n) {
  if (n == null) return "N/A";
  return parseFloat(n).toFixed(1) + "%";
}

function processAnalytics(raw, ranges) {
  // Support both old scraper format and new API format
  const cur  = raw.current  || {};
  const prev = raw.previous || {};
  const yoy  = raw.yoy      || {};

  // ── Overview ──────────────────────────────────────────────
  const curViews   = safeNum(cur.overview?.views);
  const prevViews  = safeNum(prev.overview?.views);
  const yoyViews   = safeNum(yoy.overview?.views);

  const curWatchTime   = safeNum(cur.overview?.watchTime);
  const prevWatchTime  = safeNum(prev.overview?.watchTime);

  const curAvgDur   = safeNum(cur.overview?.averageViewDuration);
  const prevAvgDur  = safeNum(prev.overview?.averageViewDuration);

  const curAvgPct   = safeNum(cur.overview?.averageViewPercentage);
  const prevAvgPct  = safeNum(prev.overview?.averageViewPercentage);

  const curSubsGained  = safeNum(cur.overview?.subscribersGained);
  const prevSubsGained = safeNum(prev.overview?.subscribersGained);
  const curSubsLost    = safeNum(cur.overview?.subscribersLost);
  const prevSubsLost   = safeNum(prev.overview?.subscribersLost);
  const curNetSubs     = curSubsGained - curSubsLost;
  const prevNetSubs    = prevSubsGained - prevSubsLost;

  const curLikes    = safeNum(cur.overview?.likes);
  const prevLikes   = safeNum(prev.overview?.likes);
  const curDislikes = safeNum(cur.overview?.dislikes);
  const curShares   = safeNum(cur.overview?.shares);
  const prevShares  = safeNum(prev.overview?.shares);
  const curComments = safeNum(cur.overview?.comments);
  const prevComments= safeNum(prev.overview?.comments);

  // ── Reach ─────────────────────────────────────────────────
  const curImpressions   = safeNum(cur.reach?.impressions);
  const prevImpressions  = safeNum(prev.reach?.impressions);
  const curCTR     = safeNum(cur.reach?.impressionsCTR);
  const prevCTR    = safeNum(prev.reach?.impressionsCTR);

  // ── Monetization ──────────────────────────────────────────
  const curRevenue  = safeNum(cur.monetization?.estimatedRevenue);
  const prevRevenue = safeNum(prev.monetization?.estimatedRevenue);
  const yoyRevenue  = safeNum(yoy.monetization?.estimatedRevenue);
  const curCpm      = safeNum(cur.monetization?.playbackBasedCpm);

  // ── Cards & End screens ────────────────────────────────────
  const curCardClicks      = safeNum(cur.cards?.cardClicks);
  const curCardImpressions = safeNum(cur.cards?.cardImpressions);
  const curCardClickRate   = safeNum(cur.cards?.cardClickRate);
  const curTeaserClicks    = safeNum(cur.cards?.cardTeaserClicks);
  const curTeaserImps      = safeNum(cur.cards?.cardTeaserImpressions);
  const curTeaserRate      = safeNum(cur.cards?.cardTeaserClickRate);

  const curEsClicks  = safeNum(cur.endScreens?.clicks);
  const curEsImps    = safeNum(cur.endScreens?.impressions);
  const curEsRate    = safeNum(cur.endScreens?.clickRate);

  // ── Premium ────────────────────────────────────────────────
  const curPremViews  = safeNum(cur.premium?.premiumViews);
  const curPremWatch  = safeNum(cur.premium?.premiumWatchTime);
  const curPremRev    = safeNum(cur.premium?.premiumRevenue);
  const prevPremViews = safeNum(prev.premium?.premiumViews);

  // ── Build processed output ────────────────────────────────
  return {
    ranges,
    channelId:    raw.channelId,
    channelTitle: raw.channelTitle,

    // Raw numbers for prompt builder
    raw: { current: cur, previous: prev, yoy },

    overview: {
      views:              { current: curViews,    previous: prevViews,    yoy: yoyViews,   fmt: fmt(curViews) },
      watchTime:          { current: curWatchTime, previous: prevWatchTime,               fmt: fmt(curWatchTime) + " min" },
      averageViewDuration:{ current: curAvgDur,  previous: prevAvgDur,                    fmt: fmtDuration(curAvgDur) },
      averageViewPct:     { current: curAvgPct,  previous: prevAvgPct,                    fmt: fmtPct(curAvgPct) },
      subscribersGained:  { current: curSubsGained, previous: prevSubsGained,             fmt: fmt(curSubsGained) },
      subscribersLost:    { current: curSubsLost,                                         fmt: fmt(curSubsLost) },
      netSubscribers:     { current: curNetSubs,  previous: prevNetSubs,                  fmt: fmt(curNetSubs) },
      likes:              { current: curLikes,    previous: prevLikes,                    fmt: fmt(curLikes) },
      dislikes:           { current: curDislikes,                                         fmt: fmt(curDislikes) },
      shares:             { current: curShares,   previous: prevShares,                   fmt: fmt(curShares) },
      comments:           { current: curComments, previous: prevComments,                 fmt: fmt(curComments) },
    },

    reach: {
      impressions:    { current: curImpressions,  previous: prevImpressions, fmt: fmt(curImpressions) },
      ctr:            { current: curCTR,          previous: prevCTR,         fmt: fmtPct(curCTR) },
      trafficSources: cur.trafficSource || [],
    },

    audience: {
      newAndReturning:    cur.newAndReturning    || [],
      viewerAge:          cur.viewerAge          || [],
      viewerGender:       cur.viewerGender       || {},
      subscriptionStatus: cur.subscriptionStatus || [],
      subscriptionSource: cur.subscriptionSource || [],
      geography:          cur.geography          || [],
      cities:             cur.cities             || [],
    },

    engagement: {
      avgViewDuration: { current: curAvgDur, previous: prevAvgDur, fmt: fmtDuration(curAvgDur) },
      avgViewPct:      { current: curAvgPct, previous: prevAvgPct, fmt: fmtPct(curAvgPct) },
      likes:           curLikes,
      dislikes:        curDislikes,
      likeRatio:       curDislikes > 0 ? (curLikes / (curLikes + curDislikes) * 100).toFixed(1) + "%" : "N/A",
      shares:          curShares,
      comments:        curComments,
      topVideos:       cur.topVideos || [],
    },

    monetization: {
      revenue:           { current: curRevenue,  previous: prevRevenue, yoy: yoyRevenue, fmt: "$" + curRevenue.toFixed(2) },
      cpm:               { current: curCpm,      fmt: "$" + curCpm.toFixed(2) },
      premiumViews:      { current: curPremViews, previous: prevPremViews, fmt: fmt(curPremViews) },
      premiumWatchTime:  { current: curPremWatch, fmt: fmt(curPremWatch) + " min" },
      premiumRevenue:    { current: curPremRev,   fmt: "$" + curPremRev.toFixed(2) },
      monetizedPlaybacks:{ current: safeNum(cur.monetization?.monetizedPlaybacks), fmt: fmt(safeNum(cur.monetization?.monetizedPlaybacks)) },
    },

    cards: {
      clicks:         curCardClicks,
      impressions:    curCardImpressions,
      clickRate:      fmtPct(curCardClickRate),
      teaserClicks:   curTeaserClicks,
      teaserImpressions: curTeaserImps,
      teaserRate:     fmtPct(curTeaserRate),
      byType:         cur.cardType || [],
    },

    endScreens: {
      clicks:      curEsClicks,
      impressions: curEsImps,
      clickRate:   fmtPct(curEsRate),
      byType:      cur.endScreenType || [],
    },

    content: {
      contentType:     cur.contentType     || [],
      deviceType:      cur.deviceType      || [],
      operatingSystem: cur.operatingSystem || [],
      playbackLocation:cur.playbackLocation|| [],
      youtubeProduct:  cur.youtubeProduct  || [],
      sharingService:  cur.sharingService  || [],
      subtitles:       cur.subtitles       || [],
      videoInfoLanguage: cur.videoInfoLanguage || [],
    },

    playlists: cur.playlists || [],

    timeSeries: cur.timeSeries || [],

    growth: {
      views:              { vsPrev: pctChange(curViews,       prevViews),       vsYoY: pctChange(curViews, yoyViews) },
      watchTime:          { vsPrev: pctChange(curWatchTime,   prevWatchTime) },
      netSubscribers:     { vsPrev: pctChange(curNetSubs,     prevNetSubs) },
      subscribersGained:  { vsPrev: pctChange(curSubsGained,  prevSubsGained) },
      revenue:            { vsPrev: pctChange(curRevenue,     prevRevenue),     vsYoY: pctChange(curRevenue, yoyRevenue) },
      impressions:        { vsPrev: pctChange(curImpressions, prevImpressions) },
      ctr:                { vsPrev: pctChange(curCTR,         prevCTR) },
      avgViewDuration:    { vsPrev: pctChange(curAvgDur,      prevAvgDur) },
      likes:              { vsPrev: pctChange(curLikes,        prevLikes) },
      shares:             { vsPrev: pctChange(curShares,       prevShares) },
      comments:           { vsPrev: pctChange(curComments,     prevComments) },
      premiumViews:       { vsPrev: pctChange(curPremViews,   prevPremViews) },
    },
  };
}

module.exports = { processAnalytics, safeNum, pctChange, fmt, fmtDuration, fmtPct };

import { useEffect, useState } from 'react'
import { getChannelInfo, getChannelUploads, getChannelDailyAnalytics, getDashboardStats, listVideos } from '../api'
import Topbar from '../components/Topbar'
import { StatCard, StatCardsGrid } from '../components/StatCard'
import { TrendingUp, Eye, Users, ExternalLink, ThumbsUp, MessageSquare, Clock, CheckCircle2, AlertCircle, Video } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts'
import { format, parseISO, subDays } from 'date-fns'

export default function Analytics({ authStatus, authLoading }) {
  const [stats, setStats] = useState(null)
  const [videos, setVideos] = useState([])
  const [info, setInfo]     = useState(null)
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(true)
  const [dailyAnalytics, setDailyAnalytics] = useState([])
  const [channelDailyError, setChannelDailyError] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [daysWindow, setDaysWindow] = useState(30)
  const [rankingSort, setRankingSort] = useState('performance_desc')
  const [historySort, setHistorySort] = useState('newest')

  async function load() {
    if (authLoading) return
    if (!authStatus?.connected) { setLoading(false); return }
    const hasAnyData = Boolean(stats) || Boolean(info) || videos.length > 0 || uploads.length > 0 || dailyAnalytics.length > 0
    if (!hasAnyData) setLoading(true)
    try {
      const [statsRes, videosRes, infoRes, uploadRes, dailyRes] = await Promise.all([
        getDashboardStats(),
        listVideos(),
        getChannelInfo(),
        getChannelUploads(),
        getChannelDailyAnalytics().catch(() => ({ data: { daily: [] } })),
      ])
      setStats(statsRes.data)
      setVideos(videosRes.data.videos || [])
      setInfo(infoRes.data)
      setUploads(uploadRes.data.videos || [])
      setDailyAnalytics(dailyRes.data.daily || [])
      setChannelDailyError(dailyRes.data.error || '')
    } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [authStatus?.connected, authLoading])

  useEffect(() => {
    if (!dailyAnalytics.length) return
    const maxDate = dailyAnalytics[dailyAnalytics.length - 1]?.date
    if (!maxDate) return
    setDateTo(maxDate)
    setDateFrom(format(subDays(parseISO(maxDate), daysWindow - 1), 'yyyy-MM-dd'))
  }, [dailyAnalytics])

  if (authLoading) {
    return (
      <>
        <Topbar title="Analytics" subtitle="Loading channel statistics" />
        <div className="page-body">
          <div className="flex-center page-loader">
            <span className="spinner" />
          </div>
        </div>
      </>
    )
  }

  if (!authStatus?.connected) {
    return (
      <>
        <Topbar title="Analytics" subtitle="YouTube channel statistics" />
        <div className="page-body">
          <div className="alert alert-warning">⚠️ Connect your YouTube channel to see analytics</div>
        </div>
      </>
    )
  }

  const metricSource = uploads.length > 0 ? uploads : videos
  const totalViews = metricSource.reduce((sum, v) => sum + Number(v.view_count || 0), 0)
  const totalLikes = metricSource.reduce((sum, v) => sum + Number(v.like_count || 0), 0)
  const totalComments = metricSource.reduce((sum, v) => sum + Number(v.comment_count || 0), 0)
  const publicMetricSource = metricSource.filter(v => String(v.privacy || '').toLowerCase() === 'public')
  const unlistedMetricSource = metricSource.filter(v => String(v.privacy || '').toLowerCase() === 'unlisted')
  const privateMetricSource = metricSource.filter(v => String(v.privacy || '').toLowerCase() === 'private')
  const isShort = (item) => {
    if (typeof item?.is_short === 'boolean') return item.is_short
    const dur = Number(item?.duration_seconds || 0)
    const title = String(item?.title || '').toLowerCase()
    return dur > 0 && (dur <= 60 || title.includes('#shorts'))
  }
  const trackedShorts = metricSource.filter(isShort)
  const trackedVideos = metricSource.filter(v => !isShort(v))
  const analyticsRows = Array.isArray(dailyAnalytics) ? dailyAnalytics : []
  const analyticsViews = analyticsRows.reduce((sum, d) => sum + Number(d.views || 0), 0)
  const analyticsWatchMins = analyticsRows.reduce((sum, d) => sum + Number(d.watch_time_minutes || 0), 0)
  const weightedAvgDurationSec = analyticsViews > 0
    ? analyticsRows.reduce((sum, d) => sum + (Number(d.avg_view_duration_seconds || 0) * Number(d.views || 0)), 0) / analyticsViews
    : 0
  const totalWatchMins = analyticsWatchMins > 0
    ? analyticsWatchMins
    : metricSource.reduce((sum, v) => sum + Number(v.watch_time_minutes || 0), 0)
  const hasLikeCommentData = metricSource.some((v) => Number(v.like_count || 0) > 0 || Number(v.comment_count || 0) > 0)
  const hasWatchData = totalWatchMins > 0
  const totalWatchHours = hasWatchData ? totalWatchMins / 60 : null
  const engagementRate = totalViews > 0 && hasLikeCommentData
    ? ((totalLikes + totalComments) / totalViews) * 100
    : null
  const trackedViewsTotal = metricSource.reduce((sum, v) => sum + Number(v.view_count || 0), 0)
  const trackedWatchMinsTotal = metricSource.reduce((sum, v) => sum + Number(v.watch_time_minutes || 0), 0)
  const avgWatchPerVideo = metricSource.length > 0 && trackedWatchMinsTotal > 0 ? trackedWatchMinsTotal / metricSource.length : null
  const avgWatchDurationSec = trackedViewsTotal > 0 && trackedWatchMinsTotal > 0
    ? (trackedWatchMinsTotal * 60) / trackedViewsTotal
    : (weightedAvgDurationSec > 0
      ? weightedAvgDurationSec
      : (analyticsViews > 0 && analyticsWatchMins > 0 ? (analyticsWatchMins * 60) / analyticsViews : null))
  const avgViewsShorts = trackedShorts.length > 0
    ? trackedShorts.reduce((sum, v) => sum + Number(v.view_count || 0), 0) / trackedShorts.length
    : null
  const avgViewsVideos = trackedVideos.length > 0
    ? trackedVideos.reduce((sum, v) => sum + Number(v.view_count || 0), 0) / trackedVideos.length
    : null
  const avgEngagementVideos = (() => {
    const views = trackedVideos.reduce((sum, v) => sum + Number(v.view_count || 0), 0)
    if (!views) return null
    const interactions = trackedVideos.reduce((sum, v) => sum + Number(v.like_count || 0) + Number(v.comment_count || 0), 0)
    return (interactions / views) * 100
  })()
  const avgEngagementShorts = (() => {
    const views = trackedShorts.reduce((sum, v) => sum + Number(v.view_count || 0), 0)
    if (!views) return null
    const interactions = trackedShorts.reduce((sum, v) => sum + Number(v.like_count || 0) + Number(v.comment_count || 0), 0)
    return (interactions / views) * 100
  })()
  const videoSample = metricSource.slice(-14)
  const viewsSeries = analyticsRows.length > 1
    ? analyticsRows.map((d) => Number(d.views || 0))
    : videoSample.map((v) => Number(v.view_count || 0))
  const watchSeries = analyticsRows.length > 1
    ? analyticsRows.map((d) => Number(d.watch_time_minutes || 0))
    : videoSample.map((v) => Number(v.watch_time_minutes || 0))
  const durationSeries = analyticsRows.length > 1
    ? analyticsRows.map((d) => Number(d.avg_view_duration_seconds || 0))
    : videoSample.map((v) => {
      const views = Number(v.view_count || 0)
      const watch = Number(v.watch_time_minutes || 0)
      return views > 0 ? (watch * 60) / views : 0
    })
  const likesSeries = videoSample.map((v) => Number(v.like_count || 0))
  const commentsSeries = videoSample.map((v) => Number(v.comment_count || 0))
  const engagementSeries = analyticsRows.length > 1
    ? analyticsRows.map((d) => {
      const views = Number(d.views || 0)
      const watch = Number(d.watch_time_minutes || 0)
      return views > 0 ? (watch * 60) / views : 0
    })
    : videoSample.map((v) => {
      const views = Number(v.view_count || 0)
      const interactions = Number(v.like_count || 0) + Number(v.comment_count || 0)
      return views > 0 ? (interactions / views) * 100 : 0
    })
  const subscribersSeries = analyticsRows.length > 1
    ? analyticsRows.map((d) => Number(d.subscribers_gained || d.subscribersGained || 0))
    : viewsSeries
  const viewsVideosSeries = trackedVideos.slice(-14).map((v) => Number(v.view_count || 0))
  const viewsShortsSeries = trackedShorts.slice(-14).map((v) => Number(v.view_count || 0))
  const engagementVideosSeries = trackedVideos.slice(-14).map((v) => {
    const views = Number(v.view_count || 0)
    const interactions = Number(v.like_count || 0) + Number(v.comment_count || 0)
    return views > 0 ? (interactions / views) * 100 : 0
  })
  const engagementShortsSeries = trackedShorts.slice(-14).map((v) => {
    const views = Number(v.view_count || 0)
    const interactions = Number(v.like_count || 0) + Number(v.comment_count || 0)
    return views > 0 ? (interactions / views) * 100 : 0
  })
  const publicViews = publicMetricSource.reduce((sum, v) => sum + Number(v.view_count || 0), 0)
  const unlistedViews = unlistedMetricSource.reduce((sum, v) => sum + Number(v.view_count || 0), 0)
  const privateViews = privateMetricSource.reduce((sum, v) => sum + Number(v.view_count || 0), 0)
  const combinedTrackedVideoCount = publicMetricSource.length + unlistedMetricSource.length + privateMetricSource.length

  const rangeStart = dateFrom || format(subDays(new Date(), daysWindow - 1), 'yyyy-MM-dd')
  const rangeEnd = dateTo || format(new Date(), 'yyyy-MM-dd')

  const filteredDaily = dailyAnalytics.filter(d => d.date >= rangeStart && d.date <= rangeEnd)
  const availableDataEnd = dailyAnalytics.length ? dailyAnalytics[dailyAnalytics.length - 1].date : null

  const norm = (value, max) => (max > 0 ? Number(value || 0) / max : 0)
  const uploadsInRange = uploads.filter(v => {
    if (!v.published_at) return false
    const day = format(parseISO(v.published_at), 'yyyy-MM-dd')
    return day >= rangeStart && day <= rangeEnd
  })

  // Ranking should consider all fetched uploads, not only the chart date window.
  const rankingSource = uploads

  const maxViews = Math.max(...rankingSource.map(v => Number(v.view_count || 0)), 0)
  const maxLikes = Math.max(...rankingSource.map(v => Number(v.like_count || 0)), 0)
  const maxComments = Math.max(...rankingSource.map(v => Number(v.comment_count || 0)), 0)
  const maxWatch = Math.max(...rankingSource.map(v => Number(v.watch_time_minutes || 0)), 0)

  const withScore = rankingSource.map(v => {
    const score = (
      norm(v.view_count, maxViews) * 0.45 +
      norm(v.like_count, maxLikes) * 0.2 +
      norm(v.comment_count, maxComments) * 0.2 +
      norm(v.watch_time_minutes, maxWatch) * 0.15
    ) * 100
    const engagement_score =
      Number(v.view_count || 0) +
      Number(v.like_count || 0) * 8 +
      Number(v.comment_count || 0) * 15 +
      Number(v.watch_time_minutes || 0) * 0.5
    return {
      ...v,
      performance_score: Math.round(score * 10) / 10,
      engagement_score: Number(v.like_count || 0) + Number(v.comment_count || 0),
      engagement_rate: Number(v.view_count || 0) > 0
        ? ((Number(v.like_count || 0) + Number(v.comment_count || 0)) / Number(v.view_count || 0)) * 100
        : 0,
    }
  })

  // Use channel-level daily analytics for the chart if available;
  // fallback to aggregating per-video stats by upload date.
  const viewTrend = dailyAnalytics.length > 0
    ? filteredDaily
        .map(d => ({
          dateLabel: format(parseISO(d.date), 'MMM d'),
          fullDate: d.date,
          views: Number(d.views || 0),
          watchTime: Math.round(d.watch_time_minutes),
        }))
    : (() => {
        // Fallback: aggregate by unique date to avoid duplicate x-axis labels
        const byDate = {}
        uploads
          .filter(v => v.published_at)
          .forEach(v => {
            const key = format(parseISO(v.published_at), 'MMM d')
            byDate[key] = (byDate[key] || 0) + Number(v.view_count || 0)
          })
        return Object.entries(byDate)
          .sort((a, b) => new Date(Date.parse(`${a[0]} 2024`)) - new Date(Date.parse(`${b[0]} 2024`)))
          .map(([dateLabel, views]) => ({ dateLabel, fullDate: null, views: Number(views || 0), watchTime: 0 }))
      })()

  const ranked = [...withScore].sort((a, b) => {
    if (rankingSort === 'views_desc') return Number(b.view_count || 0) - Number(a.view_count || 0)
    if (rankingSort === 'views_asc') return Number(a.view_count || 0) - Number(b.view_count || 0)
    if (rankingSort === 'engagement_desc') return Number(b.engagement_score || 0) - Number(a.engagement_score || 0)
    if (rankingSort === 'engagement_asc') return Number(a.engagement_score || 0) - Number(b.engagement_score || 0)
    if (rankingSort === 'watch_desc') return Number(b.watch_time_minutes || 0) - Number(a.watch_time_minutes || 0)
    if (rankingSort === 'watch_asc') return Number(a.watch_time_minutes || 0) - Number(b.watch_time_minutes || 0)
    if (rankingSort === 'performance_asc') return Number(a.performance_score || 0) - Number(b.performance_score || 0)

    if (Number(b.engagement_score || 0) !== Number(a.engagement_score || 0)) {
      return Number(b.engagement_score || 0) - Number(a.engagement_score || 0)
    }
    if (Number(b.performance_score || 0) !== Number(a.performance_score || 0)) {
      return Number(b.performance_score || 0) - Number(a.performance_score || 0)
    }
    return new Date(b.published_at || 0) - new Date(a.published_at || 0)
  })

  const rankedWithData = ranked.filter(v => (
    Number(v.view_count || 0) > 0 ||
    Number(v.like_count || 0) > 0 ||
    Number(v.comment_count || 0) > 0 ||
    Number(v.watch_time_minutes || 0) > 0 ||
    Number(v.engagement_score || 0) > 0
  ))

  const hasAnyEngagement = rankedWithData.length > 0
  const topPerforming = rankedWithData.slice(0, 5)
  const topIds = new Set(topPerforming.map(v => v.youtube_id))
  const worstPerforming = hasAnyEngagement
    ? [...rankedWithData].reverse().filter(v => !topIds.has(v.youtube_id)).slice(0, 5)
    : []
  const sortedUploads = [...uploads].sort((a, b) => {
    const aPublished = a.published_at ? new Date(a.published_at).getTime() : 0
    const bPublished = b.published_at ? new Date(b.published_at).getTime() : 0
    const aViews = Number(a.view_count || 0)
    const bViews = Number(b.view_count || 0)
    const aWatch = Number(a.watch_time_minutes || 0)
    const bWatch = Number(b.watch_time_minutes || 0)
    const aEngagement = Number(a.like_count || 0) + Number(a.comment_count || 0)
    const bEngagement = Number(b.like_count || 0) + Number(b.comment_count || 0)

    if (historySort === 'oldest') return aPublished - bPublished
    if (historySort === 'views_desc') return bViews - aViews
    if (historySort === 'views_asc') return aViews - bViews
    if (historySort === 'engagement_desc') return bEngagement - aEngagement
    if (historySort === 'engagement_asc') return aEngagement - bEngagement
    if (historySort === 'watch_desc') return bWatch - aWatch
    if (historySort === 'watch_asc') return aWatch - bWatch
    return bPublished - aPublished
  })
  const hasChannelDailyData = dailyAnalytics.length > 0
  const rangeViewsTotal = viewTrend.reduce((sum, point) => sum + Number(point.views || 0), 0)
  const rangeWatchMinsTotal = viewTrend.reduce((sum, point) => sum + Number(point.watchTime || 0), 0)
  const rangePointCount = viewTrend.length
  const avgDailyViews = rangePointCount > 0 ? rangeViewsTotal / rangePointCount : 0
  const avgViewsLine = rangePointCount > 0 ? Math.round(avgDailyViews) : null
  const peakViewsPoint = rangePointCount > 0
    ? viewTrend.reduce((best, point) => Number(point.views || 0) > Number(best.views || 0) ? point : best, viewTrend[0])
    : null
  const firstViews = rangePointCount > 0 ? Number(viewTrend[0].views || 0) : 0
  const lastViews = rangePointCount > 0 ? Number(viewTrend[rangePointCount - 1].views || 0) : 0
  const trendDeltaPct = firstViews > 0 ? ((lastViews - firstViews) / firstViews) * 100 : null

  function formatCompact(value) {
    const num = Number(value || 0)
    if (!Number.isFinite(num)) return '0'
    return num.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })
  }

  return (
    <>
      <Topbar title="Analytics" subtitle={info?.channel_title || 'Channel analytics'} />
      <div className="page-body fade-up">
        {loading ? (
          <div className="flex-center" style={{ height: '400px' }}>
            <span className="spinner" />
          </div>
        ) : (
          <div className="content-max-width">
            
            <div className="stats-grid" style={{ marginBottom: 'var(--space-8)' }}>
              <StatCard icon={<Video size={24} />} value={combinedTrackedVideoCount > 0 ? combinedTrackedVideoCount.toLocaleString() : (info?.video_count != null ? Number(info.video_count).toLocaleString() : '—')} label="Total Videos" infoText="Combined public, unlisted, and private videos when available. Falls back to channel total from YouTube." colorClass="purple" />
              <StatCard icon={<CheckCircle2 size={24} />} value={stats?.published ?? '—'} label="Uploaded" colorClass="cyan" />
              <StatCard icon={<Clock size={24} />} value={stats?.scheduled ?? '—'} label="Scheduled" colorClass="orange" />
              <StatCard icon={<AlertCircle size={24} />} value={stats?.failed ?? '—'} label="Failed" colorClass="red" />
            </div>

            <StatCardsGrid className="dashboard-secondary-stats" style={{ marginBottom: 'var(--space-8)' }}>
              <StatCard icon={<Users size={24} />} value={Number(info?.subscriber_count || 0).toLocaleString()} label="Subscribers" infoText="Current subscriber count from your connected channel." sparkData={subscribersSeries} colorClass="purple" />
              <StatCard icon={<Eye size={24} />} value={Number(totalViews || info?.view_count || 0).toLocaleString()} label="Tracked Views" infoText="Total views from tracked videos." sparkData={viewsSeries} colorClass="cyan" />
              <StatCard icon={<TrendingUp size={24} />} value={totalWatchHours != null ? `${totalWatchHours.toFixed(1)}h` : '—'} label="Total Watch Hours" infoText="Total watch minutes divided by 60." sparkData={watchSeries} colorClass="orange" />
              <StatCard icon={<CheckCircle2 size={24} />} value={engagementRate != null ? `${engagementRate.toFixed(2)}%` : '—'} label="Engagement Rate" infoText="(Likes + comments) / views × 100." sparkData={engagementSeries} colorClass="purple" />
              <StatCard icon={<ThumbsUp size={24} />} value={hasLikeCommentData ? totalLikes.toLocaleString() : '—'} label="Total Likes" infoText="Sum of likes across tracked videos." sparkData={likesSeries} colorClass="blue" />
              <StatCard icon={<MessageSquare size={24} />} value={hasLikeCommentData ? totalComments.toLocaleString() : '—'} label="Total Comments" infoText="Sum of comments across tracked videos." sparkData={commentsSeries} colorClass="red" />
              <StatCard icon={<Clock size={24} />} value={avgWatchDurationSec != null ? `${Math.round(avgWatchDurationSec)}s` : (avgWatchPerVideo != null ? `${avgWatchPerVideo.toFixed(1)} min` : '—')} label="Avg Watch Duration" infoText="Average watch time per view in seconds." sparkData={durationSeries} colorClass="orange" />
              <StatCard icon={<Eye size={24} />} value={avgViewsVideos != null ? `${Math.round(avgViewsVideos).toLocaleString()}` : '—'} label="Avg Views (Videos)" infoText="Average views for tracked non-Short videos across all privacy types." sparkData={viewsVideosSeries} colorClass="purple" />
              <StatCard icon={<Eye size={24} />} value={avgViewsShorts != null ? `${Math.round(avgViewsShorts).toLocaleString()}` : '—'} label="Avg Views (Shorts)" infoText="Average views for tracked Shorts across all privacy types." sparkData={viewsShortsSeries} colorClass="blue" />
              <StatCard icon={<TrendingUp size={24} />} value={avgEngagementVideos != null ? `${avgEngagementVideos.toFixed(2)}%` : '—'} label="Avg Engagement (Videos)" infoText="For tracked non-Short videos: (likes + comments) / views × 100 across all privacy types." sparkData={engagementVideosSeries} colorClass="orange" />
              <StatCard icon={<TrendingUp size={24} />} value={avgEngagementShorts != null ? `${avgEngagementShorts.toFixed(2)}%` : '—'} label="Avg Engagement (Shorts)" infoText="For tracked Shorts: (likes + comments) / views × 100 across all privacy types." sparkData={engagementShortsSeries} colorClass="cyan" />
              <StatCard icon={<Video size={24} />} value={publicMetricSource.length.toLocaleString()} label="Public Videos" infoText={`Public uploads tracked in analytics. Total views: ${publicViews.toLocaleString()}.`} colorClass="blue" />
              <StatCard icon={<Video size={24} />} value={unlistedMetricSource.length.toLocaleString()} label="Unlisted Videos" infoText={`Unlisted uploads tracked in analytics. Total views: ${unlistedViews.toLocaleString()}.`} colorClass="orange" />
              <StatCard icon={<Video size={24} />} value={privateMetricSource.length.toLocaleString()} label="Private Videos" infoText={`Private uploads tracked in analytics. Total views: ${privateViews.toLocaleString()}.`} colorClass="red" />
            </StatCardsGrid>

            {channelDailyError && (
              <div className="alert alert-warning" style={{ marginBottom: 'var(--space-8)' }}>
                Watch metrics unavailable right now: {channelDailyError}
              </div>
            )}

            {/* Main Engagement Chart */}
            <div className="glass-panel" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-8)' }}>
                <div>
                  <h3 className="card-title" style={{ fontSize: '20px', marginBottom: '4px' }}>Performance Trend</h3>
                  <p className="card-subtitle">Views and watch time for the selected date range</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="date" 
                    value={dateFrom} 
                    onChange={e => setDateFrom(e.target.value)}
                    style={{ background: 'var(--surface-raised, rgba(0,0,0,0.03))', border: '1px solid var(--border-color, rgba(0,0,0,0.12))', color: 'var(--text-primary)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}
                  />
                  <input 
                    type="date" 
                    value={dateTo} 
                    onChange={e => setDateTo(e.target.value)}
                    style={{ background: 'var(--surface-raised, rgba(0,0,0,0.03))', border: '1px solid var(--border-color, rgba(0,0,0,0.12))', color: 'var(--text-primary)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '10px',
                marginBottom: 'var(--space-6)'
              }}>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-raised, rgba(0,0,0,0.02))', border: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Range Views</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{rangeViewsTotal.toLocaleString()}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-raised, rgba(0,0,0,0.02))', border: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Range Watch Time</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(rangeWatchMinsTotal).toLocaleString()} min</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-raised, rgba(0,0,0,0.02))', border: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Avg Daily Views</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(avgDailyViews).toLocaleString()}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-raised, rgba(0,0,0,0.02))', border: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Peak Day</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {peakViewsPoint ? `${peakViewsPoint.dateLabel} (${Number(peakViewsPoint.views || 0).toLocaleString()})` : '—'}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-raised, rgba(0,0,0,0.02))', border: '1px solid var(--border-color, rgba(0,0,0,0.08))' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Trend vs Start</div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: trendDeltaPct == null ? 'var(--text-primary)' : (trendDeltaPct >= 0 ? '#22c55e' : '#ef4444')
                  }}>
                    {trendDeltaPct == null ? '—' : `${trendDeltaPct >= 0 ? '+' : ''}${trendDeltaPct.toFixed(1)}%`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: 'var(--primary)' }} /> Views
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#f59e0b' }} /> Watch Time (min)
                </span>
                {avgViewsLine != null && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span style={{ width: '14px', borderTop: '2px dashed var(--text-tertiary)' }} /> Avg Views Baseline
                  </span>
                )}
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  Data points: {rangePointCount} {hasChannelDailyData ? '(daily analytics)' : '(fallback from uploads)'}
                </span>
              </div>

              <div style={{ height: '320px', width: '100%', minHeight: '320px', marginBottom: 'var(--space-4)', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                  <LineChart data={viewTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, rgba(0,0,0,0.12))" vertical={false} />
                    <XAxis 
                      dataKey="dateLabel" 
                      tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} 
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <YAxis 
                      yAxisId="views"
                      tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(value) => formatCompact(value)}
                    />
                    <YAxis 
                      yAxisId="watch"
                      orientation="right"
                      tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} 
                      axisLine={false} 
                      tickLine={false}
                      tickFormatter={(value) => formatCompact(value)}
                    />
                    <Tooltip
                      labelFormatter={(label, payload) => {
                        const point = payload && payload[0] ? payload[0].payload : null
                        if (point?.fullDate) return format(parseISO(point.fullDate), 'MMM d, yyyy')
                        return label
                      }}
                      formatter={(value, name) => {
                        if (name === 'Views') return [Number(value || 0).toLocaleString(), 'Views']
                        return [`${Math.round(Number(value || 0)).toLocaleString()} min`, 'Watch Time']
                      }}
                      contentStyle={{ 
                        background: 'rgba(20,20,22,0.9)', 
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                      }}
                      itemStyle={{ color: '#fff', fontWeight: '700' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-tertiary)' }} />
                    {avgViewsLine != null && (
                      <ReferenceLine
                        yAxisId="views"
                        y={avgViewsLine}
                        stroke="var(--text-tertiary)"
                        strokeDasharray="4 4"
                      />
                    )}
                    <Line 
                      type="monotone" 
                      yAxisId="views"
                      dataKey="views" 
                      name="Views"
                      stroke="var(--primary)" 
                      strokeWidth={3} 
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      yAxisId="watch"
                      dataKey="watchTime"
                      name="Watch Time (min)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
              <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
                  <h3 className="card-title" style={{ marginBottom: 0, fontSize: '16px' }}>Top Videos</h3>
                </div>
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                  {topPerforming.map(v => {
                    const privacy = String(v.privacy || 'unknown').toLowerCase()
                    const privacyColor = privacy === 'public' ? '#22c55e' : (privacy === 'unlisted' ? '#f59e0b' : (privacy === 'private' ? '#ef4444' : 'var(--text-tertiary)'))
                    const privacyBg = privacy === 'public' ? 'rgba(34,197,94,0.12)' : (privacy === 'unlisted' ? 'rgba(245,158,11,0.12)' : (privacy === 'private' ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.12)'))
                    const typeLabel = isShort(v) ? 'Short' : 'Video'
                    return (
                      <div key={v.youtube_id} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                        <img src={v.thumbnail} alt={v.title} style={{ width: '80px', height: '45px', borderRadius: '8px', objectFit: 'cover' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</div>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '2px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{Number(v.view_count).toLocaleString()} views</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <ThumbsUp size={12} /> {Number(v.like_count || 0).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <MessageSquare size={12} /> {Number(v.comment_count || 0).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600' }}>
                              Performance: {v.performance_score}%
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <div style={{ fontSize: '11px', padding: '4px 8px', background: privacyBg, color: privacyColor, borderRadius: '6px', fontWeight: '700' }}>
                            {privacy.charAt(0).toUpperCase() + privacy.slice(1)}
                          </div>
                          <div style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', borderRadius: '6px', fontWeight: '700' }}>
                            {typeLabel}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
                <h3 className="card-title" style={{ marginBottom: 'var(--space-6)', fontSize: '16px' }}>Needs Improvement</h3>
                 <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                  {worstPerforming.map(v => {
                    const privacy = String(v.privacy || 'unknown').toLowerCase()
                    const privacyColor = privacy === 'public' ? '#22c55e' : (privacy === 'unlisted' ? '#f59e0b' : (privacy === 'private' ? '#ef4444' : 'var(--text-tertiary)'))
                    const privacyBg = privacy === 'public' ? 'rgba(34,197,94,0.12)' : (privacy === 'unlisted' ? 'rgba(245,158,11,0.12)' : (privacy === 'private' ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.12)'))
                    const typeLabel = isShort(v) ? 'Short' : 'Video'
                    return (
                      <div key={v.youtube_id} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                        <img src={v.thumbnail} alt={v.title} style={{ width: '80px', height: '45px', borderRadius: '8px', objectFit: 'cover' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</div>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '2px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{Number(v.view_count).toLocaleString()} views</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <ThumbsUp size={12} /> {Number(v.like_count || 0).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <MessageSquare size={12} /> {Number(v.comment_count || 0).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600' }}>
                              Performance: {v.performance_score}%
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <div style={{ fontSize: '11px', padding: '4px 8px', background: privacyBg, color: privacyColor, borderRadius: '6px', fontWeight: '700' }}>
                            {privacy.charAt(0).toUpperCase() + privacy.slice(1)}
                          </div>
                          <div style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', borderRadius: '6px', fontWeight: '700' }}>
                            {typeLabel}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <h3 className="card-title">Upload History</h3>
                  <select
                    className="form-select"
                    value={historySort}
                    onChange={(e) => setHistorySort(e.target.value)}
                    style={{ minWidth: 220 }}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="views_desc">Views: High to Low</option>
                    <option value="views_asc">Views: Low to High</option>
                    <option value="engagement_desc">Engagement: High to Low</option>
                    <option value="engagement_asc">Engagement: Low to High</option>
                    <option value="watch_desc">Watch Time: High to Low</option>
                    <option value="watch_asc">Watch Time: Low to High</option>
                  </select>
                </div>
              </div>
              <div className="video-list" style={{ padding: '0' }}>
                {sortedUploads.map(v => (
                  <div key={v.youtube_id} style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <img src={v.thumbnail} alt={v.title} style={{ width: '120px', height: '67px', borderRadius: '10px', marginRight: 'var(--space-5)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{v.title}</div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{v.published_at ? new Date(v.published_at).toLocaleDateString() : 'Draft'} • {Number(v.view_count).toLocaleString()} views</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ThumbsUp size={13} /> {Number(v.like_count || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MessageSquare size={13} /> {Number(v.comment_count || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: '600' }}>
                          Interactions: {Number(v.like_count || 0) + Number(v.comment_count || 0)} ({Number(v.view_count || 0) > 0 ? (Math.round((Number(v.like_count || 0) + Number(v.comment_count || 0)) / Number(v.view_count || 0) * 1000) / 10).toFixed(1) : '0'}%)
                        </div>
                      </div>
                    </div>
                    <a href={v.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                      <ExternalLink size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </>

  )
}

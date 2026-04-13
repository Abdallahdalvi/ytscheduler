import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats, getAuthUrl, listVideos, getChannelInfo, getChannelUploads, getChannelDailyAnalytics } from '../api'
import Topbar from '../components/Topbar'
import VideoItem from '../components/VideoItem'
import { StatCard, StatCardsGrid } from '../components/StatCard'
import { Card, CardHeader, CardBody } from '../components/Card'
import {
  Video, CheckCircle2, Clock, AlertCircle,
  Upload, Calendar, PlayCircle, TrendingUp, FolderPlus,
  Users, Eye, ThumbsUp, MessageSquare,
  ArrowRight
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function Dashboard({ authStatus, authLoading, onRefresh }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [channelInfo, setChannelInfo] = useState(null)
  const [videos, setVideos] = useState([])
  const [channelUploads, setChannelUploads] = useState([])
  const [channelDaily, setChannelDaily] = useState([])
  const [channelDailyError, setChannelDailyError] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')

  async function load() {
    setLoading(true)
    try {
      const [statsRes, videosRes, channelRes, uploadsRes, dailyRes] = await Promise.all([
        getDashboardStats(),
        listVideos(),
        getChannelInfo().catch(() => ({ data: null })),
        getChannelUploads().catch(() => ({ data: { videos: [] } })),
        getChannelDailyAnalytics().catch(() => ({ data: { daily: [] } })),
      ])

      const managedRows = (videosRes.data.videos || []) as any[]
      const channelRows = (uploadsRes.data.videos || []) as any[]
      const managedByYoutube = new Map(
        managedRows.filter((row) => row.youtube_id).map((row) => [String(row.youtube_id), row]),
      )

      const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')

      const merged = channelRows.map((row) => {
        const linked = row.youtube_id ? managedByYoutube.get(String(row.youtube_id)) : undefined
        const thumbUrl = row.thumbnail || (linked?.thumbnail_path ? `${API_BASE}/uploads/${linked.thumbnail_path.split(/[\\/]/).pop()}` : undefined) || `https://i.ytimg.com/vi/${row.youtube_id}/mqdefault.jpg`
        
        return {
          ...linked,
          ...row,
          source: linked ? 'managed' : 'channel',
          managedId: linked?.id ?? null,
          id: row.youtube_id || linked?.id || `yt-${Math.random().toString(36).slice(2, 9)}`,
          youtube_id: row.youtube_id || linked?.youtube_id,
          view_count: Number(row.view_count || linked?.view_count || 0),
          like_count: Number(row.like_count || linked?.like_count || 0),
          comment_count: Number(row.comment_count || linked?.comment_count || 0),
          watch_time_minutes: Number(row.watch_time_minutes || linked?.watch_time_minutes || 0),
          thumbnail_url: thumbUrl,
        }
      })

      const channelIds = new Set(merged.map((row) => String(row.youtube_id || '')))
      const managedOnly = managedRows
        .filter((row) => !row.youtube_id || !channelIds.has(String(row.youtube_id)))
        .map((row) => {
             const thumbUrl = row.thumbnail_path ? `${API_BASE}/uploads/${row.thumbnail_path.split(/[\\/]/).pop()}` : undefined
             return { 
               ...row, 
               source: 'managed', 
               managedId: row.id,
               thumbnail_url: thumbUrl,
             }
        })

      setStats(statsRes.data)
      setVideos([...merged, ...managedOnly])
      setChannelInfo(channelRes.data)
      setChannelUploads(channelRows)
      setChannelDaily(dailyRes.data.daily || [])
      setChannelDailyError(dailyRes.data.error || '')
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    load()
    
    // Listen for auth success message from the callback popup
    const handleAuthMessage = (e) => {
      if (e.data === 'connected') {
        console.log('[Dashboard] Auth success detected via postMessage');
        onRefresh?.();
        load();
      }
    };
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [onRefresh])

  async function handleConnect() {
    try {
      const res = await getAuthUrl()
      const authUrl = res?.data?.data?.url || res?.data?.url
      if (!authUrl) throw new Error('Auth URL not returned by server')
      window.open(authUrl, '_blank', 'width=600,height=700')
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.data?.detail || e.message
      alert(msg)
    }
  }

  const filteredVideos = videos.filter(v => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'queued') return v.status === 'queued'
    return v.status === activeFilter
  })

  const upcomingVideos = [...videos]
    .filter(v => v.status === 'scheduled' && v.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 5)

  const recentActivity = [...videos]
    .sort((a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0))
    .slice(0, 8)

  const metricSource = channelUploads.length > 0 ? channelUploads : videos
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
  const analyticsRows = Array.isArray(channelDaily) ? channelDaily : []
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
  const avgViewsPerVideo = metricSource.length > 0 ? trackedViewsTotal / metricSource.length : null
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
  const avgEngagementShorts = (() => {
    const views = trackedShorts.reduce((sum, v) => sum + Number(v.view_count || 0), 0)
    if (!views) return null
    const interactions = trackedShorts.reduce((sum, v) => sum + Number(v.like_count || 0) + Number(v.comment_count || 0), 0)
    return (interactions / views) * 100
  })()
  const avgEngagementVideos = (() => {
    const views = trackedVideos.reduce((sum, v) => sum + Number(v.view_count || 0), 0)
    if (!views) return null
    const interactions = trackedVideos.reduce((sum, v) => sum + Number(v.like_count || 0) + Number(v.comment_count || 0), 0)
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
  const combinedTrackedVideoCount = publicMetricSource.length + unlistedMetricSource.length + privateMetricSource.length

  if (authLoading) {
    return (
      <div className="page-body flex-center" style={{ minHeight: '100vh' }}>
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <span className="spinner" style={{ width: 48, height: 48 }} />
          <p style={{ marginTop: 20, color: 'var(--text-secondary)' }}>Loading channel state...</p>
        </div>
      </div>
    )
  }

  if (!authStatus?.connected) {
    return (
      <>
        <Topbar title="Dashboard" subtitle="YouTube Social Media Management" />
        <div className="page-body">
          <div className="connect-screen">
            <div className="connect-card fade-up">
              <div className="connect-icon">
                <PlayCircle size={36} color="white" />
              </div>
              <h1 className="connect-title">Connect Your YouTube Channel</h1>
              <p className="connect-sub">
                Link your YouTube account to start scheduling videos and managing your posting workflow.
              </p>
              <div className="connect-features">
                {[
                  'Auto-schedule videos at optimal time slots',
                  'Visual posting calendar (monthly/weekly)',
                  'Bulk upload & queue management',
                  'YouTube Analytics dashboard',
                ].map((f, i) => (
                  <div className="connect-feature" key={i}>
                    <CheckCircle2 size={16} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary btn-lg btn-block" onClick={handleConnect}>
                <PlayCircle size={20} /> Connect with Google
              </button>
              <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-quaternary)' }}>
                ⚠️ Make sure <code>client_secret.json</code> is in the project root folder first.
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        title={`Welcome back! 👋`}
        subtitle={`Managing ${authStatus.channel_title || 'your channel'}`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/schedule')}>
            <Upload size={16} /> Open Queue
          </button>
        }
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          {loading && (
            <div className="flex-center" style={{ padding: '60px 0' }}>
              <span className="spinner" />
            </div>
          )}

          {!loading && (
            <>
              {/* KPI Cards */}
              <div className="stats-grid" style={{ marginBottom: 32 }}>
                <StatCard 
                  icon={<Video size={24} />}
                  value={combinedTrackedVideoCount > 0 ? combinedTrackedVideoCount.toLocaleString() : (channelInfo?.video_count != null ? Number(channelInfo.video_count).toLocaleString() : (stats?.total_videos ?? '—'))} 
                  label="Total Videos" 
                  infoText="Combined public, unlisted, and private videos when available. Falls back to channel total from YouTube."
                  colorClass="purple"
                  onClick={() => setActiveFilter('all')}
                />
                <StatCard 
                  icon={<CheckCircle2 size={24} />}
                  value={stats?.published ?? '—'} 
                  label="Published" 
                  colorClass="cyan"
                  onClick={() => setActiveFilter('published')}
                />
                <StatCard 
                  icon={<Clock size={24} />}
                  value={stats?.scheduled ?? '—'} 
                  label="Scheduled" 
                  colorClass="orange"
                  onClick={() => setActiveFilter('scheduled')}
                />
                <StatCard 
                  icon={<AlertCircle size={24} />}
                  value={stats?.failed ?? '—'} 
                  label="Failed" 
                  colorClass="red"
                  onClick={() => setActiveFilter('failed')}
                />
              </div>

              <StatCardsGrid className="dashboard-secondary-stats">
                <StatCard
                  icon={<Users size={24} />}
                  value={Number(channelInfo?.subscriber_count || 0).toLocaleString()}
                  label="Subscribers"
                  infoText="Current subscriber count returned by the connected channel profile."
                  sparkData={subscribersSeries}
                  colorClass="purple"
                />
                <StatCard
                  icon={<Eye size={24} />}
                  value={Number(totalViews || channelInfo?.view_count || 0).toLocaleString()}
                  label="Tracked Views"
                  infoText="Sum of views across tracked videos. Falls back to channel total views if per-video view data is unavailable."
                  sparkData={viewsSeries}
                  colorClass="cyan"
                />
                <StatCard
                  icon={<TrendingUp size={24} />}
                  value={totalWatchHours != null ? `${totalWatchHours.toFixed(1)}h` : '—'}
                  label="Total Watch Hours"
                  infoText="Total watch time in hours = total watch minutes / 60. Uses daily analytics first, then tracked video watch minutes as fallback."
                  sparkData={watchSeries}
                  colorClass="orange"
                />
                <StatCard
                  icon={<CheckCircle2 size={24} />}
                  value={engagementRate != null ? `${engagementRate.toFixed(2)}%` : '—'}
                  label="Engagement Rate"
                  infoText="(Total likes + total comments) / total views × 100 across tracked videos."
                  sparkData={engagementSeries}
                  colorClass="purple"
                />
                <StatCard
                  icon={<ThumbsUp size={24} />}
                  value={hasLikeCommentData ? totalLikes.toLocaleString() : '—'}
                  label="Total Likes"
                  infoText="Sum of like counts across tracked videos."
                  sparkData={likesSeries}
                  colorClass="blue"
                />
                <StatCard
                  icon={<MessageSquare size={24} />}
                  value={hasLikeCommentData ? totalComments.toLocaleString() : '—'}
                  label="Total Comments"
                  infoText="Sum of comment counts across tracked videos."
                  sparkData={commentsSeries}
                  colorClass="red"
                />
                <StatCard
                  icon={<Clock size={24} />}
                  value={avgWatchDurationSec != null ? `${Math.round(avgWatchDurationSec)}s` : (avgWatchPerVideo != null ? `${avgWatchPerVideo.toFixed(1)} min` : '—')}
                  label="Avg Watch Duration"
                  infoText="Average seconds watched per view. Uses weighted daily analytics avg duration when available, otherwise (watch minutes × 60) / views."
                  sparkData={durationSeries}
                  colorClass="orange"
                />
                <StatCard
                  icon={<Eye size={24} />}
                  value={avgViewsPerVideo != null ? `${Math.round(avgViewsPerVideo).toLocaleString()}` : '—'}
                  label="Avg Views / Video"
                  infoText="Total views divided by all tracked videos, including public, unlisted, and private."
                  sparkData={viewsSeries}
                  colorClass="cyan"
                />
                <StatCard
                  icon={<Eye size={24} />}
                  value={avgViewsVideos != null ? `${Math.round(avgViewsVideos).toLocaleString()}` : '—'}
                  label="Avg Views (Videos)"
                  infoText="Average views for tracked non-Short videos across all privacy types."
                  sparkData={viewsVideosSeries}
                  colorClass="purple"
                />
                <StatCard
                  icon={<Eye size={24} />}
                  value={avgViewsShorts != null ? `${Math.round(avgViewsShorts).toLocaleString()}` : '—'}
                  label="Avg Views (Shorts)"
                  infoText="Average views for tracked Shorts across all privacy types."
                  sparkData={viewsShortsSeries}
                  colorClass="blue"
                />
                <StatCard
                  icon={<TrendingUp size={24} />}
                  value={avgEngagementVideos != null ? `${avgEngagementVideos.toFixed(2)}%` : '—'}
                  label="Avg Engagement (Videos)"
                  infoText="For tracked non-Short videos: (likes + comments) / views × 100 across all privacy types."
                  sparkData={engagementVideosSeries}
                  colorClass="orange"
                />
                <StatCard
                  icon={<TrendingUp size={24} />}
                  value={avgEngagementShorts != null ? `${avgEngagementShorts.toFixed(2)}%` : '—'}
                  label="Avg Engagement (Shorts)"
                  infoText="For tracked Shorts: (likes + comments) / views × 100 across all privacy types."
                  sparkData={engagementShortsSeries}
                  colorClass="cyan"
                />
              </StatCardsGrid>

              {channelDailyError && (
                <div className="alert alert-warning" style={{ marginTop: '12px' }}>
                  Watch metrics unavailable right now: {channelDailyError}
                </div>
              )}

              {/* Quick Action Cards */}
              <div className="section">
                <div className="grid-3">
                  {/* Upload & Schedule */}
                  <Card className="cursor-pointer" onClick={() => navigate('/schedule')} style={{ transition: 'all var(--transition)' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <CardBody>
                      <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="stat-icon purple" style={{ width: '48px', height: '48px' }}>
                          <Upload size={24} />
                        </div>
                        <ArrowRight size={18} style={{ color: 'var(--text-tertiary)' }} />
                      </div>
                      <h3 className="card-title">Upload Queue</h3>
                      <p className="card-subtitle">Upload, schedule, and publish</p>
                    </CardBody>
                  </Card>

                  {/* Analytics */}
                  <Card className="cursor-pointer" onClick={() => navigate('/analytics')} style={{ transition: 'all var(--transition)' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                    <CardBody>
                      <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="stat-icon cyan" style={{ width: '48px', height: '48px' }}>
                          <TrendingUp size={24} />
                        </div>
                        <ArrowRight size={18} style={{ color: 'var(--text-tertiary)' }} />
                      </div>
                      <h3 className="card-title">Analytics</h3>
                      <p className="card-subtitle">View performance metrics</p>
                    </CardBody>
                  </Card>

                </div>
              </div>

              {/* Main Content Grid */}
              <div className="section">
                <div className="grid-sidebar">
                  {/* Left Column */}
                  <div>
                    {/* Next Scheduled */}
                    {stats?.next_scheduled && (
                      <Card style={{ marginBottom: 'var(--space-6)' }}>
                        <CardHeader
                          title="⏰ Next Scheduled"
                          subtitle={format(parseISO(stats.next_scheduled.scheduled_at), "EEEE, MMMM d 'at' h:mm a")}
                          action={
                            <button className="btn btn-secondary btn-xs" onClick={() => navigate('/calendar')}>
                              <Calendar size={14} />
                            </button>
                          }
                        />
                        <CardBody>
                          <VideoItem video={stats.next_scheduled} onRefresh={load} />
                        </CardBody>
                      </Card>
                    )}

                    {/* Upcoming Videos */}
                    <Card style={{ marginBottom: 'var(--space-6)' }}>
                      <CardHeader
                        title="📅 Upcoming Videos"
                        subtitle={`Next ${Math.min(upcomingVideos.length, 5)} scheduled posts`}
                      />
                      <CardBody>
                        {upcomingVideos.length === 0 ? (
                          <div className="empty-state">
                            <Calendar size={40} />
                            <p>No scheduled videos yet</p>
                          </div>
                        ) : (
                          <div className="video-list">
                            {upcomingVideos.map(v => (
                              <div key={v.id} className="video-item">
                                <div className="video-thumb">
                                  {v.youtube_id ? <img src={`https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`} alt={v.title} /> : <Video size={18} className="video-thumb-icon" />}
                                </div>
                                <div className="video-info">
                                  <div className="video-title">{v.title}</div>
                                  <div className="video-meta">{v.scheduled_at ? format(parseISO(v.scheduled_at), 'MMM d, h:mm a') : 'No time set'}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  </div>

                  {/* Right Sidebar */}
                  <div>
                    {/* Recent Activity */}
                    <Card>
                      <CardHeader
                        title="📊 Recent Activity"
                        subtitle="Latest video events"
                      />
                      <CardBody>
                        {recentActivity.length === 0 ? (
                          <div className="empty-state">
                            <Video size={40} />
                            <p>No activity yet</p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {recentActivity.map(v => {
                              const msg = v.status === 'failed'
                                ? 'Upload failed'
                                : v.status === 'scheduled'
                                ? `Scheduled for ${v.scheduled_at ? format(parseISO(v.scheduled_at), 'MMM d, h:mm a') : 'later'}`
                                : v.status === 'published'
                                ? 'Video uploaded'
                                : `Status: ${v.status}`
                              return (
                                <div key={`activity-${v.id}`} style={{ paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border)' }} className="last:border-b-0">
                                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }} className="line-clamp-1">{v.title}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{msg}</div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  </div>
                </div>
              </div>

              {/* Filtered Results */}
              {filteredVideos.length > 0 && activeFilter !== 'all' && (
                <div className="section">
                  <Card>
                    <CardHeader
                      title={`${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Videos`}
                      subtitle={`Showing ${filteredVideos.length} videos`}
                      action={
                        <button className="btn btn-ghost btn-xs" onClick={() => setActiveFilter('all')}>
                          Clear Filter
                        </button>
                      }
                    />
                    <CardBody>
                      <div className="video-list">
                        {filteredVideos.slice(0, 8).map(v => <VideoItem key={v.id} video={v} onRefresh={load} />)}
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )}

              {/* No Videos State */}
              {!stats?.total_videos && (
                <Card className="section">
                  <div className="empty-state">
                    <Video size={64} />
                    <h3 className="section-title" style={{ marginBottom: 'var(--space-2)' }}>No Videos Yet</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                      Create your first post to get started with your content strategy
                    </p>
                    <button className="btn btn-primary btn-lg" onClick={() => navigate('/schedule')}>
                      <Upload size={18} /> Open Upload Queue
                    </button>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

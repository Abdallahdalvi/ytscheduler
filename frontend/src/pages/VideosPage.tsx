import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { listVideos, updateVideo, deleteVideo, deleteYouTubeVideo, uploadNow, getChannelUploads, uploadThumbnail, updateYouTubeVideo, uploadYouTubeThumbnail, rescheduleVideo, MEDIA_BASE_URL } from '../api'
import { activityService } from '../modules/activity/activity.service'
import Topbar from '../components/Topbar'
import { RefreshCw, Timer, Video, Trash2, Search, Filter, Loader2, Sparkles, Upload, X, MoreVertical, TrendingUp, ClipboardList, Pencil, Check } from 'lucide-react'
import toast from 'react-hot-toast'


type VideoRow = {
  id: string | number
  managedId?: string | number | null
  youtube_id?: string
  title?: string
  description?: string
  tags?: string | string[]
  privacy?: string
  category_id?: string
  made_for_kids?: boolean
  default_language?: string
  status?: string
  scheduled_at?: string | null
  published_at?: string | null
  thumbnail_url?: string
  thumbnailPreviewUrl?: string
  view_count?: number
  like_count?: number
  comment_count?: number
  watch_time_minutes?: number
  is_short?: boolean
  duration_seconds?: number
  created_at?: string
  source: 'managed' | 'channel'
  thumbnailFile?: File | null
}

const YOUTUBE_CATEGORIES = [
  { id: '1', name: 'Film & Animation' },
  { id: '2', name: 'Autos & Vehicles' },
  { id: '10', name: 'Music' },
  { id: '15', name: 'Pets & Animals' },
  { id: '17', name: 'Sports' },
  { id: '19', name: 'Travel & Events' },
  { id: '20', name: 'Gaming' },
  { id: '22', name: 'People & Blogs' },
  { id: '23', name: 'Comedy' },
  { id: '24', name: 'Entertainment' },
  { id: '25', name: 'News & Politics' },
  { id: '26', name: 'Howto & Style' },
  { id: '27', name: 'Education' },
  { id: '28', name: 'Science & Technology' },
  { id: '29', name: 'Nonprofits & Activism' },
]

const LANGUAGES = [
  { code: '', name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)' },
  { code: 'ru', name: 'Russian' },
  { code: 'it', name: 'Italian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'tr', name: 'Turkish' },
  { code: 'id', name: 'Indonesian' },
]

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [selectedVideos, setSelectedVideos] = useState<any[]>([])
  const [activeMenu, setActiveMenu] = useState<number | string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'managed' | 'channel'>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [bulkDate, setBulkDate] = useState('')
  const [editing, setEditing] = useState<VideoRow | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const getEngagementValue = (video: VideoRow) => {
      const likes = Number(video.like_count || 0)
      const comments = Number(video.comment_count || 0)
      return likes + comments
    }
    let rows = videos.filter((video) => {
      const bySource = sourceFilter === 'all' ? true : video.source === sourceFilter
      if (!bySource) return false
      const byStatus = statusFilter === 'all' ? true : String(video.status || '').toLowerCase() === statusFilter
      if (!byStatus) return false
      if (!q) return true
      const text = [video.title, video.youtube_id, video.description].filter(Boolean).join(' ').toLowerCase()
      return text.includes(q)
    })

    rows = rows.sort((a, b) => {
      const aPublished = a.published_at ? new Date(a.published_at).getTime() : 0
      const bPublished = b.published_at ? new Date(b.published_at).getTime() : 0
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
      const aScheduled = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
      const bScheduled = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
      const aViews = Number(a.view_count || 0)
      const bViews = Number(b.view_count || 0)
       const aEngagement = getEngagementValue(a)
      const bEngagement = getEngagementValue(b)
       if (sortBy === 'oldest') return (aCreated || aPublished) - (bCreated || bPublished)
      if (sortBy === 'scheduled_asc') return aScheduled - bScheduled
      if (sortBy === 'views_desc') return bViews - aViews
      if (sortBy === 'views_asc') return aViews - bViews
      if (sortBy === 'engagement_desc') return bEngagement - aEngagement
      if (sortBy === 'engagement_asc') return aEngagement - bEngagement
      return (bCreated || bPublished) - (aCreated || aPublished)
    })

    return rows
  }, [videos, search, sourceFilter, statusFilter, sortBy])

  const selectable = filtered
  const selectedIds = Object.entries(selected)
    .filter(([, checked]) => checked)
    .map(([id]) => id)

  function toggleSelect(id: string | number) {
    setSelected((prev) => ({ ...prev, [String(id)]: !prev[String(id)] }))
  }

  function toggleSelectAll() {
    if (!selectable.length) return
    const allSelected = selectable.every((v) => selected[String(v.id)])
    if (allSelected) {
      setSelected({})
      return
    }
    const next: Record<string, boolean> = {}
    selectable.forEach((v) => { next[String(v.id)] = true })
    setSelected(next)
  }

  async function load() {
    setLoading(true)
    try {
      const [managedRes, channelRes] = await Promise.all([
        listVideos(),
        getChannelUploads().catch(() => ({ data: { videos: [] } })),
      ])

      const managedRows = (managedRes.data.videos || []) as any[]
      const channelRows = (channelRes.data.videos || []) as any[]

      const managedByYoutube = new Map(
        managedRows.filter((row) => row.youtube_id).map((row) => [String(row.youtube_id), row]),
      )


      const mergedFromChannel: VideoRow[] = channelRows.map((row) => {
        const linked = row.youtube_id ? managedByYoutube.get(String(row.youtube_id)) : undefined
        const rawManagedThumb = linked?.thumbnail_path ? `${MEDIA_BASE_URL}/uploads/${linked.thumbnail_path.split(/[\\/]/).pop()}` : undefined
        const thumbUrl = row.thumbnail || rawManagedThumb || `https://i.ytimg.com/vi/${row.youtube_id}/mqdefault.jpg`
        
        return {
          ...linked,
          ...row,
          source: linked ? 'managed' : 'channel',
          managedId: linked?.id ?? null,
          id: row.youtube_id || linked?.id || `yt-${Math.random().toString(36).slice(2, 9)}`,
          youtube_id: row.youtube_id || linked?.youtube_id,
          title: row.title || linked?.title,
          description: (row.description ?? linked?.description ?? ''),
          tags: (row.tags ?? linked?.tags ?? ''),
          privacy: row.privacy || linked?.privacy || 'public',
          category_id: row.category_id || linked?.category_id || '22',
          default_language: row.default_language || linked?.default_language || '',
          made_for_kids: typeof row.made_for_kids === 'boolean' ? row.made_for_kids : !!linked?.made_for_kids,
          status: linked?.status || row.status || 'published',
          scheduled_at: linked?.scheduled_at || row.scheduled_at || null,
          published_at: row.published_at || linked?.published_at || null,
          view_count: Number(row.view_count || linked?.view_count || 0),
          like_count: Number(row.like_count || linked?.like_count || 0),
          comment_count: Number(row.comment_count || linked?.comment_count || 0),
          watch_time_minutes: Number(row.watch_time_minutes || linked?.watch_time_minutes || 0),
          thumbnail_url: thumbUrl,
        }
      })

      const channelIds = new Set(mergedFromChannel.map((row) => String(row.youtube_id || '')))
      const managedOnly = managedRows
        .filter((row) => !row.youtube_id || !channelIds.has(String(row.youtube_id)))
        .map((row) => {
             const thumbUrl = row.thumbnail_path ? `${MEDIA_BASE_URL}/uploads/${row.thumbnail_path.split(/[\\/]/).pop()}` : undefined
             return { 
               ...row, 
               source: 'managed', 
               managedId: row.id,
               thumbnail_url: thumbUrl,
             }
        })

      setVideos([...mergedFromChannel, ...managedOnly])
    } catch {
      setVideos([])
    }
    setLoading(false)
  }



  useEffect(() => { load() }, [])

  useEffect(() => {
    const handleClickAway = () => setActiveMenu(null)
    if (activeMenu) {
      window.addEventListener('click', handleClickAway)
    }
    return () => window.removeEventListener('click', handleClickAway)
  }, [activeMenu])

  function rowSeoKey(v: VideoRow) {
    return String(v.managedId || v.youtube_id || v.id)
  }


  async function handleDelete(v: VideoRow) {
    const isChannel = v.source === 'channel'
    const hasYoutubeId = !!v.youtube_id
    
    let msg = 'Delete this video?'
    if (isChannel) msg = 'Delete this video from YouTube? This action cannot be undone.'
    else if (hasYoutubeId) msg = 'Delete this video from both the local manager and YouTube?'

    if (!window.confirm(msg)) return

    try {
      if (isChannel && hasYoutubeId) {
        await deleteYouTubeVideo(v.youtube_id!)
      } else if (v.managedId) {
        // If it has a youtube_id, our backend delete endpoint for managed videos 
        // should probably be updated to also delete from YouTube, but for now 
        // let's use the explicit YouTube delete if it's already published.
        if (hasYoutubeId) {
          await deleteYouTubeVideo(v.youtube_id!)
        } else {
          await deleteVideo(v.managedId)
        }
      }
      
      toast.success('Video deleted')
      activityService.create({
        action: 'video.deleted',
        post_id: String(v.managedId ?? v.youtube_id ?? v.id),
        metadata: {
          title: v.title || 'Untitled video',
          source: v.source,
          youtube_id: v.youtube_id || null,
        },
      }).catch(() => {})
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed')
    }
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) return
    if (!window.confirm(`Delete ${selectedIds.length} videos?`)) return
    try {
      await Promise.all(selectedIds.map(async (id) => {
        const v = videos.find(row => String(row.id) === id)
        if (!v) return
        if (v.source === 'channel' && v.youtube_id) {
          await deleteYouTubeVideo(v.youtube_id)
        } else if (v.managedId) {
          if (v.youtube_id) await deleteYouTubeVideo(v.youtube_id).catch(() => {}) 
          await deleteVideo(v.managedId).catch(() => {})
        }
      }))
      toast.success(`Deleted ${selectedIds.length} videos`)
      setSelected({})
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'Bulk delete failed')
    }
  }

  async function handleBulkReschedule() {
    const targetIds = videos
      .filter(v => selectedIds.includes(String(v.id)) && !!v.managedId)
      .map(v => v.managedId!)

    if (!targetIds.length) return toast.error('Select at least one managed video to reschedule')
    if (!bulkDate) return toast.error('Pick a date/time first')
    try {
      const iso = new Date(bulkDate).toISOString()
      await Promise.all(targetIds.map((id) => rescheduleVideo(id, { scheduled_at: iso })))
      toast.success(`Rescheduled ${targetIds.length} videos`)
      setSelected({})
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'Bulk reschedule failed')
    }
  }

  async function handlePublishNow(id: string | number, row: VideoRow) {
    await uploadNow(id)
    activityService.create({
      action: 'video.upload_started',
      post_id: String(id),
      metadata: {
        title: row?.title || 'Untitled video',
        source: row?.managedId ? 'managed' : 'channel',
        youtube_id: row?.youtube_id || null,
      },
    }).catch(() => {})
    toast.success('Upload started')
    await load()
  }

  function openEdit(v: VideoRow) {
    setEditing({ ...v, tags: formatTags(v.tags), scheduled_at: v.scheduled_at ? v.scheduled_at.slice(0, 16) : '', thumbnailPreviewUrl: undefined })
  }


  function formatTags(tags: VideoRow['tags']) {
    if (!tags) return ''
    if (Array.isArray(tags)) return tags.join(', ')
    return tags
  }

  function normalizeLocalDateTime(value?: string | null) {
    if (!value) return null
    return value.length === 16 ? `${value}:00` : value
  }

  async function handleSaveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const parsedTags = Array.isArray(editing.tags)
        ? editing.tags.map((t) => String(t).trim()).filter(Boolean)
        : String(editing.tags || '').split(',').map((t) => t.trim()).filter(Boolean)

      const sharedYtPayload = {
        title: editing.title,
        description: editing.description,
        tags: parsedTags.length ? parsedTags : undefined,
        privacy: editing.privacy,
        category_id: editing.category_id || '22',
        made_for_kids: editing.made_for_kids || false,
        default_language: editing.default_language || '',
      }

      if (editing.managedId) {
        await updateVideo(editing.managedId, {
          title: editing.title,
          description: editing.description,
          tags: parsedTags.join(', '),
          privacy: editing.privacy,
          category_id: editing.category_id || '22',
          made_for_kids: editing.made_for_kids ? 1 : 0,
          default_language: editing.default_language || '',
          scheduled_at: normalizeLocalDateTime(editing.scheduled_at),
        })
        // If already published, sync metadata to YouTube too
        if (editing.youtube_id) {
          await updateYouTubeVideo(editing.youtube_id, sharedYtPayload).catch(() => {})
        }
        if (editing.thumbnailFile) {
          const fd = new FormData()
          fd.append('thumbnail', editing.thumbnailFile)
          await uploadThumbnail(editing.managedId, fd)
          if (editing.youtube_id) {
            await uploadYouTubeThumbnail(editing.youtube_id, fd).catch(() => {})
          }
        }
      } else if (editing.youtube_id) {
        // Channel-only video — update YouTube directly
        await updateYouTubeVideo(editing.youtube_id, sharedYtPayload)
        if (editing.thumbnailFile) {
          const fd = new FormData()
          fd.append('thumbnail', editing.thumbnailFile)
          await uploadYouTubeThumbnail(editing.youtube_id, fd)
        }
      }

      activityService.create({
        action: 'video.updated',
        post_id: editing.managedId ? String(editing.managedId) : String(editing.youtube_id || ''),
        metadata: {
          title: editing.title || 'Untitled video',
          source: editing.managedId ? 'managed' : 'channel',
          youtube_id: editing.youtube_id || null,
        },
      }).catch(() => {})

      toast.success('Video updated successfully')
      setEditing(null)
      await load()
    } catch (err: any) {
      let message = err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'Failed to save video changes'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Topbar 
        title="Videos" 
        subtitle={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Manage and review {videos.length} videos</span>
          </div>
        }
        actions={<button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh</button>}
        filters={null}
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          {/* Toolbar */}
          <div className="glass-panel" style={{ marginBottom: 'var(--space-8)', padding: 'var(--space-4) var(--space-6)' }}>
            <div className="videos-toolbar" style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', pointerEvents: 'none' }} />
                <input
                  className="form-input"
                  placeholder="Search by title, ID or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 48, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                />
              </div>

              
              <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0 12px' }}>
                  <select
                    className="form-select"
                    style={{ border: 'none', background: 'transparent' }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="queued">Queued</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="uploading">Uploading</option>
                    <option value="published">Uploaded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0 12px' }}>
                  <Filter size={14} style={{ color: 'var(--primary)' }} />
                  <select 
                    className="form-select" 
                    style={{ border: 'none', background: 'transparent' }}
                    value={sourceFilter} 
                    onChange={(e) => setSourceFilter(e.target.value as any)}
                  >
                    <option value="all">All Sources</option>
                    <option value="managed">Managed</option>
                    <option value="channel">Channel</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0 12px' }}>
                  <select
                    className="form-select"
                    style={{ border: 'none', background: 'transparent' }}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="scheduled_asc">Upcoming Schedule</option>
                    <option value="views_desc">Views: High to Low</option>
                    <option value="views_asc">Views: Low to High</option>
                    <option value="engagement_desc">Engagement: High to Low</option>
                    <option value="engagement_asc">Engagement: Low to High</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-xs" onClick={toggleSelectAll} style={{ color: 'var(--primary)', fontWeight: 700 }}>
                {selectable.length > 0 && selectable.every((v) => selected[String(v.id)]) ? 'Unselect All' : 'Select All Visible'}
              </button>
              <input
                className="form-input"
                type="datetime-local"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                style={{ maxWidth: 220 }}
              />
              <button className="btn btn-secondary btn-sm" onClick={handleBulkReschedule} disabled={!selectedIds.length}>
                Bulk Reschedule ({videos.filter(v => selectedIds.includes(String(v.id)) && !!v.managedId).length})
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={!selectedIds.length}>
                Delete Selected ({selectedIds.length})
              </button>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            {loading ? (
              <div className="empty-state" style={{ padding: '120px 0' }}>
                <RefreshCw size={32} className="spin" style={{ color: 'var(--primary)' }} />
                <p style={{ marginTop: '20px', color: 'var(--text-tertiary)' }}>Loading videos...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: '120px 0' }}>
                <Video size={64} style={{ color: 'rgba(255,255,255,0.05)', marginBottom: '24px' }} />
                <p style={{ fontSize: '18px', fontWeight: '700' }}>No Videos Found</p>
                <p style={{ color: 'var(--text-tertiary)', marginTop: '8px' }}>No videos match your current filters</p>
              </div>
            ) : (
              <div className="videos-list" style={{ display: 'grid', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
                {filtered.map((v) => {
                  return (
                  <div key={`${v.source}-${v.id}`} className="video-row-item" style={{ 
                    background: 'var(--surface-primary)', 
                    padding: 'var(--space-5) var(--space-6)',
                    display: 'flex',
                    gap: '24px',
                    alignItems: 'center',
                    transition: 'background 0.2s ease'
                  }}>
                    <div style={{ flexShrink: 0, width: 20, display: 'flex', justifyContent: 'center' }}>
                      <input
                        type="checkbox"
                        checked={!!selected[String(v.id)]}
                        onChange={() => toggleSelect(v.id)}
                      />
                    </div>
                    {/* Thumbnail Clip */}
                    <div style={{ 
                      width: '120px', height: '68px', borderRadius: '12px', 
                      background: 'rgba(0,0,0,0.2)', overflow: 'hidden', flexShrink: 0,
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      {(v.youtube_id || v.thumbnail_url) ? (
                        <img 
                          src={v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`} 
                          alt="clip" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-quaternary)' }}>
                          <Video size={28} strokeWidth={1} />
                        </div>
                      )}
                    </div>

                    {/* Core Context */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.title}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        </div>
                        {v.published_at && (
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Timer size={11} /> {format(parseISO(v.published_at), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metrics Cluster */}
                    <div style={{ display: 'flex', gap: '16px', padding: '0 16px', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ textAlign: 'center', minWidth: '40px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{v.view_count || 0}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>VIEWS</div>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: '40px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{v.like_count || 0}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>LIKES</div>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: '40px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{v.comment_count || 0}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>COMMENTS</div>
                      </div>
                    </div>

                    {/* Execution Suite */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* Primary Action */}
                      {v.managedId && !['published', 'uploading'].includes(String(v.status || '').toLowerCase()) && !v.youtube_id ? (
                        <button className="btn btn-primary btn-sm" onClick={() => handlePublishNow(v.managedId!, v)}>Publish Now</button>
                      ) : (v.managedId || v.youtube_id) ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(v)}>Edit</button>
                      ) : null}

                      {/* Overflow Menu */}
                      <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="btn btn-ghost btn-xs" 
                          style={{ padding: '8px', borderRadius: '50%' }}
                          onClick={() => setActiveMenu(activeMenu === v.id ? null : v.id)}
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {activeMenu === v.id && (
                          <div className="dropdown-menu">
                            {(v.managedId || v.youtube_id) && (
                              <button className="dropdown-item" onClick={() => { openEdit(v); setActiveMenu(null); }}>
                                <Upload size={14} /> Edit Video
                              </button>
                            )}
                            {v.managedId && !['published', 'uploading'].includes(String(v.status || '').toLowerCase()) && !v.youtube_id && (
                                <button className="dropdown-item" onClick={() => { handlePublishNow(v.managedId!, v); setActiveMenu(null); }}>
                                  <Upload size={14} /> Publish Now
                                </button>
                            )}
                            <div className="dropdown-divider"></div>
                            <button className="dropdown-item danger" onClick={() => { handleDelete(v); setActiveMenu(null); }}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {editing && (
          <div className="modal-overlay" onClick={() => { setEditing(null) }}>
            <div
              className="glass-panel"
              style={{ width: '620px', maxHeight: '90vh', overflowY: 'auto', padding: 'var(--space-8)', position: 'relative' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 className="card-title" style={{ margin: 0 }}>Edit Video</h2>
                <button className="btn btn-ghost btn-xs" onClick={() => { setEditing(null) }}><X size={16} /></button>
              </div>

              {/* Thumbnail */}
              <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                <label className="form-label">Thumbnail</label>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ width: 160, height: 90, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                    {(editing.thumbnailPreviewUrl || editing.thumbnail_url || editing.youtube_id) ? (
                      <img
                        src={editing.thumbnailPreviewUrl || editing.thumbnail_url || `https://i.ytimg.com/vi/${editing.youtube_id}/mqdefault.jpg`}
                        alt="thumbnail"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-quaternary)' }}><Video size={28} strokeWidth={1} /></div>
                    )}
                  </div>
                  <label style={{ cursor: 'pointer' }}>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const url = URL.createObjectURL(file)
                        setEditing(p => ({ ...p!, thumbnailFile: file, thumbnailPreviewUrl: url }))
                      }}
                    />
                    <span className="btn btn-secondary btn-sm"><Upload size={14} /> Upload New Thumbnail</span>
                  </label>
                  {editing.thumbnailPreviewUrl && (
                    <button className="btn btn-ghost btn-xs" onClick={() => setEditing(p => ({ ...p!, thumbnailFile: undefined, thumbnailPreviewUrl: undefined }))}>
                      <X size={12} /> Remove
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                {/* Title */}
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    className="form-input"
                    value={editing.title || ''}
                    onChange={e => setEditing(p => ({ ...p!, title: e.target.value }))}
                    placeholder="Video title (55-70 chars recommended)"
                  />
                  <span style={{ fontSize: 11, color: (editing.title?.length || 0) > 70 ? 'var(--danger)' : 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>
                    {editing.title?.length || 0} / 100 characters
                  </span>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows={6}
                    value={editing.description || ''}
                    onChange={e => setEditing(p => ({ ...p!, description: e.target.value }))}
                    placeholder="Describe your video. Add keywords, links, and a call-to-action."
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>
                    {editing.description?.length || 0} characters
                  </span>
                </div>


                {/* Tags */}
                <div className="form-group">
                  <label className="form-label">Tags <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(comma-separated)</span></label>
                  <input
                    className="form-input"
                    value={editing.tags || ''}
                    onChange={e => setEditing(p => ({ ...p!, tags: e.target.value }))}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>

                {/* Category + Language */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={editing.category_id || '22'} onChange={e => setEditing(p => ({ ...p!, category_id: e.target.value }))}>
                      {YOUTUBE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Language</label>
                    <select className="form-select" value={editing.default_language || ''} onChange={e => setEditing(p => ({ ...p!, default_language: e.target.value }))}>
                      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Visibility + Schedule */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Visibility</label>
                    <select className="form-select" value={editing.privacy || 'public'} onChange={e => setEditing(p => ({ ...p!, privacy: e.target.value }))}>
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Schedule Date</label>
                    <input type="datetime-local" className="form-input" value={editing.scheduled_at || ''} onChange={e => setEditing(p => ({ ...p!, scheduled_at: e.target.value }))} />
                  </div>
                </div>

                {/* Made for Kids */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <input
                    type="checkbox"
                    id="made_for_kids"
                    checked={!!editing.made_for_kids}
                    onChange={e => setEditing(p => ({ ...p!, made_for_kids: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  <label htmlFor="made_for_kids" style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Made for Kids</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>Disables comments and personalized ads</span>
                  </label>
                </div>
              </div>

              <div style={{ marginTop: '28px', display: 'flex', gap: '12px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={handleSaveEdit}>
                  {saving ? <Loader2 size={16} className="spin" /> : 'Save Changes'}
                </button>
                <button className="btn btn-secondary" disabled={saving} onClick={() => { setEditing(null) }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

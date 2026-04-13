import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { PlayCircle, ExternalLink, Trash2, Clock, Upload, PlusCircle, CheckCircle2, Calendar, X, Save } from 'lucide-react'
import { deleteVideo, uploadNow, assignNextSlot, retryFailed, rescheduleVideo, MEDIA_BASE_URL } from '../api'
import { activityService } from '../modules/activity/activity.service'
import toast from 'react-hot-toast'

function StatusBadge({ status }) {
  const map = {
    published: 'Uploaded',
    scheduled: 'Scheduled',
    queued:    'Queued',
    uploading: 'Uploading…',
    failed:    'Failed',
  }
  const styleMap = {
    published: 'badge-success',
    scheduled: 'badge-warning',
    queued: 'badge-info',
    uploading: 'badge-primary',
    failed: 'badge-danger',
  }
  return <span className={`badge ${styleMap[status] || 'badge-primary'}`}>{map[status] || status}</span>
}

function PrivacyBadge({ privacy }) {
  const colors = { public: '#10b981', unlisted: '#f59e0b', private: '#94a3b8' }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: colors[privacy] || '#94a3b8' }}>
      {privacy?.charAt(0).toUpperCase() + privacy?.slice(1)}
    </span>
  )
}

export default function VideoItem({ video, onRefresh }) {
  const [showManual, setShowManual] = useState(false)
  const [manualDate, setManualDate] = useState(video.scheduled_at ? video.scheduled_at.slice(0, 16) : '')

  async function handleDelete() {
    if (!confirm(`Delete "${video.title}"?`)) return
    await deleteVideo(video.id)
    activityService.create({
      action: 'video.deleted',
      post_id: String(video.id),
      metadata: { title: video.title || 'Untitled video', status: video.status || null, youtube_id: video.youtube_id || null },
    }).catch(() => {})
    toast.success('Video removed')
    onRefresh()
  }

  async function handleUploadNow() {
    await uploadNow(video.id)
    activityService.create({
      action: 'video.upload_started',
      post_id: String(video.id),
      metadata: { title: video.title || 'Untitled video', youtube_id: video.youtube_id || null },
    }).catch(() => {})
    toast.success('Upload started! Check progress below.')
    onRefresh()
  }

  async function handleAssignSlot() {
    try {
      const res = await assignNextSlot(video.id)
      activityService.create({
        action: 'video.scheduled',
        post_id: String(video.id),
        metadata: {
          title: video.title || 'Untitled video',
          next_slot: res?.data?.next_slot || null,
          youtube_id: video.youtube_id || null,
        },
      }).catch(() => {})
      toast.success(`Scheduled for ${format(parseISO(res.data.next_slot || res.data.video.scheduled_at), 'MMM d, h:mm a')}`)
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No slots configured yet')
    }
  }

  async function handleManualReschedule() {
    if (!manualDate) return toast.error('Pick a date first')
    try {
      const iso = new Date(manualDate).toISOString()
      await rescheduleVideo(video.id, { scheduled_at: iso })
      activityService.create({
        action: 'video.rescheduled',
        post_id: String(video.id),
        metadata: { title: video.title || 'Untitled video', scheduled_at: iso },
      }).catch(() => {})
      toast.success('Video rescheduled manually')
      setShowManual(false)
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Manual reschedule failed')
    }
  }

  async function handleRetry() {
    try {
      await retryFailed(video.id)
      activityService.create({
        action: 'video.retry_requested',
        post_id: String(video.id),
        metadata: { title: video.title || 'Untitled video' },
      }).catch(() => {})
      toast.success('Video moved back to queue. You can schedule or upload now.')
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Retry failed')
    }
  }

  const scheduledLabel = video.scheduled_at
    ? format(parseISO(video.scheduled_at), 'MMM d, yyyy · h:mm a')
    : null
  const publishedLabel = video.published_at
    ? format(parseISO(video.published_at), 'MMM d, yyyy')
    : null
  const rawThumb = video.thumbnail_url || (video.youtube_id ? `https://i.ytimg.com/vi/${video.youtube_id}/mqdefault.jpg` : null)
  const thumbnailSrc = (rawThumb && rawThumb.startsWith('/uploads')) 
    ? `${MEDIA_BASE_URL}${rawThumb}` 
    : rawThumb

  return (
    <div className="glass-card fade-up" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: 'var(--space-4)', 
      gap: 'var(--space-5)', 
      marginBottom: 'var(--space-3)',
      border: '1px solid rgba(255,255,255,0.03)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'default'
    }}>
      {/* Thumbnail */}
      <div style={{ 
        width: '120px', 
        height: '68px', 
        borderRadius: '10px', 
        overflow: 'hidden', 
        background: 'rgba(255,255,255,0.02)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={video.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <PlayCircle size={24} style={{ color: 'var(--text-quaternary)' }} />
        )}
        <div style={{ position: 'absolute', bottom: '4px', right: '4px' }}>
          <PrivacyBadge privacy={video.privacy} />
        </div>
      </div>

      {/* Info Cluster */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: '700', 
          color: 'var(--text-primary)', 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          letterSpacing: '-0.2px'
        }} title={video.title}>
          {video.title}
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <StatusBadge status={video.status} />
          
          {scheduledLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '600' }}>
              <Clock size={12} /> {scheduledLabel}
            </div>
          )}
          
          {publishedLabel && (
            <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={12} /> Uploaded · {publishedLabel}
            </div>
          )}
        </div>

        {video.status === 'uploading' && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
              <span>Uploading...</span>
              <span>{Math.round((video.upload_progress || 0) * 100)}%</span>
            </div>
            <div className="progress-bar" style={{ height: '4px' }}>
              <div className="progress-fill" style={{ width: `${Math.round((video.upload_progress || 0) * 100)}%` }} />
            </div>
          </div>
        )}
        
        {video.status === 'failed' && (
          <div style={{ 
            fontSize: '11px', 
            color: 'var(--danger)', 
            marginTop: '4px', 
            background: 'rgba(239, 68, 68, 0.05)', 
            padding: '4px 8px', 
            borderRadius: '6px',
            border: '1px solid rgba(239, 68, 68, 0.1)'
          }}>
            {video.error_message}
          </div>
        )}
      </div>

      {/* Action Suite */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {video.youtube_id && (
          <a
            href={video.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            title="Open on YouTube"
            style={{ padding: '8px' }}
          >
            <ExternalLink size={16} />
          </a>
        )}
        
        {['queued', 'scheduled'].includes(video.status) && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {showManual ? (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  value={manualDate} 
                  onChange={e => setManualDate(e.target.value)}
                  style={{ height: '28px', fontSize: '11px', width: '160px', background: 'transparent', border: 'none', padding: 0 }}
                />
                <button className="btn btn-primary btn-xs" onClick={handleManualReschedule} style={{ padding: '4px 8px' }}>
                  <Save size={12} />
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => setShowManual(false)} style={{ padding: '4px 8px' }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={handleAssignSlot} 
                  onContextMenu={(e) => { e.preventDefault(); setShowManual(true) }}
                  title="Left-click: Auto-slot | Right-click: Manual"
                  style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                >
                  <Clock size={14} /> <span style={{ marginLeft: '6px' }}>{video.status === 'scheduled' ? 'Reschedule' : 'Schedule'}</span>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowManual(true)} title="Pick specific time" style={{ padding: '8px' }}>
                  <Calendar size={14} />
                </button>
              </>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleUploadNow} style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}>
              <Upload size={14} /> <span style={{ marginLeft: '6px' }}>Now</span>
            </button>
          </div>
        )}

        {video.status === 'failed' && (
          <button className="btn btn-secondary btn-sm" onClick={handleRetry} style={{ height: '32px' }}>
            Retry
          </button>
        )}

        <button 
          className="btn btn-ghost btn-sm" 
          onClick={handleDelete} 
          style={{ color: 'rgba(239, 68, 68, 0.6)', padding: '8px' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(239, 68, 68, 0.6)'}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

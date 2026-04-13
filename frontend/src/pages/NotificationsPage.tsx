import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'
import { notificationsService } from '../modules/notifications/notifications.service'
import toast from 'react-hot-toast'
import { Bell, CheckCheck, Info, AlertTriangle, AlertCircle, Megaphone, Loader2, Clock3 } from 'lucide-react'

const TYPE_META = {
  system:  { Icon: Bell,          color: 'var(--primary)',  bg: 'var(--primary-light)'  },
  info:    { Icon: Info,          color: 'var(--info)',     bg: 'var(--info-light)'     },
  warning: { Icon: AlertTriangle, color: 'var(--warning)',  bg: 'var(--warning-light)'  },
  error:   { Icon: AlertCircle,   color: 'var(--danger)',   bg: 'var(--danger-light)'   },
  promo:   { Icon: Megaphone,     color: 'var(--success)',  bg: 'var(--success-light)'  },
}

function typeIcon(type: string) {
  const meta = TYPE_META[type] || TYPE_META.system
  const { Icon, color, bg } = meta
  return (
    <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={16} color={color} />
    </div>
  )
}

export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const unreadCount = items.filter((n) => n.status !== 'read').length

  async function load() {
    setLoading(true)
    try {
      const data = await notificationsService.list()
      setItems(data)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function markRead(id: string) {
    try {
      await notificationsService.markRead(id)
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, status: 'read' } : n))
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Update failed')
    }
  }

  async function markAllRead() {
    if (!unreadCount) return
    setMarkingAll(true)
    try {
      await notificationsService.markAllRead()
      setItems((prev) => prev.map((n) => ({ ...n, status: 'read' })))
      toast.success('All notifications marked as read')
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to mark all read')
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <>
      <Topbar
        title="Signal Analytics"
        subtitle={unreadCount > 0 ? `${unreadCount} unread transmissions detected` : 'Neural signals synchronized'}
        actions={
          unreadCount > 0 ? (
            <button className="btn btn-primary btn-sm" onClick={markAllRead} disabled={markingAll}>
              {markingAll ? <Loader2 size={14} className="spin" /> : <CheckCheck size={14} />}
              Mark All Read
            </button>
          ) : null
        }
        filters={null}
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          <div className="glass-panel" style={{ padding: '0' }}>
            {loading ? (
              <div className="empty-state" style={{ padding: '80px 0' }}>
                <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
                <p style={{ marginTop: '16px', color: 'var(--text-tertiary)' }}>Syncing neural signals...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="empty-state" style={{ padding: '80px 0' }}>
                <Bell size={48} style={{ color: 'rgba(255,255,255,0.05)', marginBottom: '20px' }} />
                <p style={{ fontSize: '16px', fontWeight: '600' }}>Baseline Tranquility</p>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '8px' }}>Transmissions will manifest as system events occur</p>
              </div>
            ) : (
              <div className="notif-list" style={{ display: 'grid', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
                {items.map((item) => (
                  <div key={item.id} className={`notif-item${item.status !== 'read' ? ' notif-unread' : ''}`} style={{ 
                    background: item.status !== 'read' ? 'rgba(59, 130, 246, 0.03)' : 'var(--surface-primary)', 
                    padding: 'var(--space-6)',
                    display: 'flex',
                    gap: '20px',
                    transition: 'background 0.2s ease',
                    position: 'relative'
                  }}>
                    {item.status !== 'read' && (
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'var(--primary)' }} />
                    )}
                    
                    {/* Icon Section */}
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ 
                        width: '44px', height: '44px', borderRadius: '14px', 
                        background: TYPE_META[item.type as keyof typeof TYPE_META]?.bg || 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: TYPE_META[item.type as keyof typeof TYPE_META]?.color || 'var(--primary)'
                      }}>
                        {typeIcon(item.type)}
                      </div>
                    </div>

                    <div className="notif-body" style={{ flex: 1 }}>
                      <div className="notif-title" style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
                        {item.title}
                      </div>
                      <div className="notif-text" style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '12px' }}>
                        {item.body}
                      </div>
                      <div className="notif-meta" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        <span className={`badge badge-${item.type === 'error' ? 'failed' : item.type === 'warning' ? 'scheduled' : 'published'}`} style={{ fontSize: '9px', textTransform: 'uppercase' }}>
                          {item.type}
                        </span>
                        <span>·</span>
                        <span>{item.delivery}</span>
                        <span>·</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock3 size={11} /> {item.created_at ? new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                        </span>
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, alignSelf: 'center' }}>
                      {item.status !== 'read' ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => markRead(item.id)} title="Acknowledge Signal">
                          <CheckCheck size={16} style={{ color: 'var(--primary)' }} />
                        </button>
                      ) : (
                        <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', opacity: 0.4 }}>
                          <CheckCheck size={14} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

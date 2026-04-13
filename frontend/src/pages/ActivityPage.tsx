import { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import { activityService } from '../modules/activity/activity.service'
import toast from 'react-hot-toast'
import { Search, Filter, Clock3, Loader2, Activity } from 'lucide-react'

type ActivityLog = {
  id: string
  action: string
  metadata?: Record<string, unknown>
  created_at?: string
}

function formatActionName(action: string) {
  return action.replace(/[._-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  async function load() {
    setLoading(true)
    try {
      const data = await activityService.list(100)
      setItems(data)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load activity logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const actionOptions = useMemo(() => {
    const unique = Array.from(new Set(items.map((i) => i.action).filter(Boolean)))
    return ['all', ...unique]
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesAction = actionFilter === 'all' || item.action === actionFilter
      const matchesQuery = !q || item.action.toLowerCase().includes(q) || JSON.stringify(item.metadata || {}).toLowerCase().includes(q)
      return matchesAction && matchesQuery
    })
  }, [items, query, actionFilter])

  return (
    <>
      <Topbar 
        title="Neural Activity Monitor" 
        subtitle="Real-time chronological log of system operations and distribution events" 
        actions={null}
        filters={null}
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          {/* Toolbar */}
          <div className="glass-panel" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
            <div className="activity-toolbar" style={{ gap: 'var(--space-4)' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
                <input
                  className="form-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search system logs..."
                  style={{ paddingLeft: 44, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                />
              </div>
              <div className="activity-filter-wrap" style={{ 
                background: 'rgba(255,255,255,0.02)', 
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '12px',
                padding: '0 12px'
              }}>
                <Filter size={14} style={{ color: 'var(--primary)' }} />
                <select className="form-select" style={{ border: 'none', background: 'transparent' }} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
                  {actionOptions.map((opt) => (
                    <option key={opt} value={opt} style={{ background: '#000' }}>{opt === 'all' ? 'All Operations' : formatActionName(opt)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="glass-panel" style={{ padding: '0' }}>
            {loading ? (
              <div className="empty-state" style={{ padding: '80px 0' }}>
                <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
                <p style={{ marginTop: '16px', color: 'var(--text-tertiary)' }}>Syncing neural logs...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: '80px 0' }}>
                <Activity size={40} style={{ color: 'rgba(255,255,255,0.1)' }} />
                <p style={{ marginTop: '16px', color: 'var(--text-tertiary)' }}>No activity records found in this sequence</p>
              </div>
            ) : (
              <div className="activity-list" style={{ display: 'grid', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
                {filtered.map((item) => (
                  <div key={item.id} className="activity-item" style={{ 
                    background: 'var(--surface-primary)', 
                    padding: 'var(--space-5) var(--space-6)',
                    transition: 'background 0.2s ease',
                    cursor: 'default'
                  }}>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <div style={{ 
                        width: '40px', height: '40px', borderRadius: '12px', 
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
                        flexShrink: 0
                      }}>
                        <Activity size={18} />
                      </div>
                      <div className="activity-content" style={{ flex: 1 }}>
                        <div className="activity-head" style={{ marginBottom: '8px' }}>
                          <div className="activity-title" style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>
                            {formatActionName(item.action)}
                          </div>
                          <div className="activity-time" style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock3 size={13} /> {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                          </div>
                        </div>
                        {item.metadata && Object.keys(item.metadata).length > 0 ? (
                          <pre className="activity-meta" style={{ 
                            background: 'rgba(255,255,255,0.01)', 
                            border: '1px solid rgba(255,255,255,0.03)',
                            padding: '12px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            marginTop: '12px'
                          }}>
                            {JSON.stringify(item.metadata, null, 2)}
                          </pre>
                        ) : null}
                      </div>
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

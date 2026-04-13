import { useEffect, useMemo, useState } from 'react'
import { getCalendar, updateVideo, deleteVideo, uploadNow, uploadThumbnail, getSettings, getSlots, generateSchedule, deleteSlot } from '../api'
import Topbar from '../components/Topbar'
import { ChevronLeft, ChevronRight, RefreshCw, TrashIcon } from 'lucide-react'
import { format, getDaysInMonth, startOfMonth, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

const DAYS_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_CAL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarPage({ authStatus }: { authStatus: any }) {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState(null)
  
  // Scheduling controls
  const [slots, setSlots] = useState([])
  const [postsPerWeek, setPostsPerWeek] = useState(5)
  const [genLoading, setGenLoading] = useState(false)
  const [generationMeta, setGenerationMeta] = useState(null)

  const groupedSlots = useMemo(() => {
    const grouped = DAYS_WEEK.map((day, idx) => ({ day, day_of_week: idx, slots: [] }))
    for (const slot of slots) {
      const dayIdx = Number(slot.day_of_week)
      if (Number.isFinite(dayIdx) && grouped[dayIdx]) {
        grouped[dayIdx].slots.push(slot)
      }
    }
    grouped.forEach(group => {
      group.slots.sort((a, b) => {
        const aKey = `${String(a.hour).padStart(2, '0')}:${String(a.minute).padStart(2, '0')}`
        const bKey = `${String(b.hour).padStart(2, '0')}:${String(b.minute).padStart(2, '0')}`
        return aKey.localeCompare(bKey)
      })
    })
    return grouped
  }, [slots])

  async function load() {
    try {
      const [calRes, setRes, slRes] = await Promise.all([
        getCalendar(year, month),
        getSettings(),
        getSlots()
      ])
      setEvents(calRes.data.events || [])
      const s = setRes.data
      setPostsPerWeek(s.posts_per_week || Math.max(1, Math.round((s.posts_per_month || 12) / 4.33)))
      setSlots(slRes.data.slots || [])
    } catch {}
  }
  useEffect(() => { load() }, [year, month])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid
  const totalDays  = getDaysInMonth(new Date(year, month - 1))
  const firstDay   = (startOfMonth(new Date(year, month - 1)).getDay() + 6) % 7 // Mon=0
  const cells      = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length < 42) cells.push(null)

  async function handleGenerateSchedule() {
    setGenLoading(true)
    try {
      const res = await generateSchedule({ posts_per_week: postsPerWeek })
      const payload = res.data || {}
      setSlots(payload.slots || [])
      setGenerationMeta({
        strategy: payload.strategy || 'unknown',
        sample_size: Number(payload.sample_size || 0),
        time_zone: payload.time_zone || 'Asia/Kolkata',
      })

      const strategyLabel =
        payload.strategy === 'ai'
          ? 'AI optimized'
          : payload.strategy === 'smart-defaults'
            ? `Research-based times (${payload.time_zone || 'Asia/Kolkata'})`
            : 'Generated'

      toast.success(`${strategyLabel}: ${payload.slots?.length || 0} weekly slots`) 
    } catch (e) {
      toast.error(e.response?.data?.error || e.response?.data?.detail || 'Failed to generate')
    }
    setGenLoading(false)
  }

  async function handleDeleteSlot(id) {
    await deleteSlot(id)
    setSlots(s => s.filter(x => x.id !== id))
    toast.success('Slot removed')
  }

  function eventsForDay(day) {
    if (!day) return []
    return events.filter(e => {
      if (!e.scheduled_at && !e.published_at) return false
      const dt = parseISO(e.scheduled_at || e.published_at)
      return dt.getFullYear() === year && dt.getMonth() + 1 === month && dt.getDate() === day
    })
  }

  // Modal state for editing a video
  const [editVideo, setEditVideo] = useState(null)
  const [editLoading, setEditLoading] = useState(false)

  const today = now.getDate()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month

  const selectedDayEvents = selected ? eventsForDay(selected) : []

  return (
    <>
      <Topbar
        title="Content Calendar"
        subtitle="Manage your distribution velocity and visual timeline"
        actions={null}
        filters={null}
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          
          {/* Calendar Header with Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '-1px', margin: 0, color: 'var(--text-primary)' }}>
                {format(new Date(year, month - 1), 'MMMM')} <span style={{ color: 'var(--primary)', opacity: 0.8 }}>{year}</span>
              </h1>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase', marginTop: '4px', letterSpacing: '1px' }}>
                Distribution Matrix Active
              </div>
            </div>
            
            <div className="glass-panel" style={{ padding: '6px', display: 'flex', gap: '4px', borderRadius: '12px' }}>
              <button className="btn btn-ghost btn-sm" style={{ padding: '8px' }} onClick={prevMonth}><ChevronLeft size={20} /></button>
              <button className="btn btn-ghost btn-sm" style={{ padding: '4px 12px', fontSize: '13px', fontWeight: '800' }} onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}>TODAY</button>
              <button className="btn btn-ghost btn-sm" style={{ padding: '8px' }} onClick={nextMonth}><ChevronRight size={20} /></button>
            </div>
          </div>

          {/* Scheduling Intelligence Toolbar */}
          <div className="glass-panel" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
            <div style={{ flex: 1 }}>
              <h3 className="card-title" style={{ fontSize: '14px', marginBottom: '4px' }}>Distribution Velocity</h3>
              <p className="card-subtitle">{postsPerWeek} assets per week · {Math.round(postsPerWeek * 4.33)} monthly</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flex: 2 }}>
              <input
                type="range"
                min="1"
                max="70"
                value={postsPerWeek}
                onChange={e => setPostsPerWeek(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--primary)' }}
              />
              <input
                className="form-input"
                type="number"
                value={postsPerWeek}
                onChange={e => setPostsPerWeek(Math.min(70, Math.max(1, Number(e.target.value))))}
                style={{ width: '80px', textAlign: 'center' }}
              />
              <button
                className="btn btn-primary"
                onClick={handleGenerateSchedule}
                disabled={genLoading}
              >
                {genLoading ? <span className="spinner" /> : <RefreshCw size={16} />} 
                <span style={{ marginLeft: '8px' }}>Sync Schedule</span>
              </button>
            </div>
          </div>

          <div className="gcal-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-8)' }}>
            <div className="glass-panel" style={{ padding: 'var(--space-4)' }}>
              <div className="gcal-week-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                {DAYS_CAL.map(d => <div key={d} style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{d}</div>)}
              </div>
              <div className="gcal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={i} style={{ height: '110px' }} />; // Hide ghost boxes
                  
                  const dayEvents = eventsForDay(day)
                  const isToday = isCurrentMonth && day === today
                  const isSelected = selected === day

                  return (
                    <button
                      key={i}
                      className={`gcal-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setSelected(selected === day ? null : day)}
                      style={{
                        height: '110px',
                        padding: '12px',
                        background: isSelected ? 'rgba(255,255,255,0.04)' : (isToday ? 'rgba(78, 115, 248, 0.05)' : 'rgba(255,255,255,0.01)'),
                        border: isSelected ? '1px solid var(--primary)' : (isToday ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)'),
                        borderRadius: '16px',
                        textAlign: 'left',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        position: 'relative',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ 
                        fontSize: '11px', 
                        fontWeight: '900', 
                        color: isToday ? 'var(--primary)' : 'var(--text-tertiary)',
                        marginBottom: '2px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        {day}
                      </div>

                      <div style={{ display: 'grid', gap: '4px', width: '100%' }}>
                        {dayEvents.slice(0, 2).map((e, j) => (
                          <div
                            key={j}
                            onClick={ev => { ev.stopPropagation(); setEditVideo(e) }}
                            style={{
                              fontSize: '10px',
                              padding: '4px 8px',
                              background: e.status === 'published' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(78, 115, 248, 0.1)',
                              color: e.status === 'published' ? '#10b981' : 'var(--primary)',
                              borderRadius: '6px',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              border: '1px solid rgba(255,255,255,0.02)',
                              display: 'block',
                              width: '100%'
                            }}
                            title={e.title}
                          >
                            {e.title}
                          </div>
                        ))}
                      </div>

                      {dayEvents.length > 2 && (
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontWeight: '800', marginTop: 'auto' }}>
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
              {selected ? (
                <div className="glass-panel fade-up" style={{ padding: 'var(--space-6)' }}>
                  <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 className="card-title" style={{ fontSize: '16px' }}>{format(new Date(year, month - 1, selected), 'MMMM d, yyyy')}</h3>
                    <p className="card-subtitle">{selectedDayEvents.length} events detected</p>
                  </div>
                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {selectedDayEvents.map(e => (
                      <div key={e.id} className="glass-card" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setEditVideo(e)}>
                        <div style={{ width: '4px', height: '24px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{e.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{e.scheduled_at ? format(parseISO(e.scheduled_at), 'h:mm a') : 'Unscheduled'}</div>
                        </div>
                      </div>
                    ))}
                    {selectedDayEvents.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-quaternary)', fontSize: '13px' }}>Empty slot</div>}
                  </div>
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: 'var(--space-6)', opacity: 0.5 }}>
                  <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-tertiary)', margin: '40px 0' }}>Select a date to view agenda</p>
                </div>
              )}

              {slots.length > 0 && (
                <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-6)' }}>
                    <RefreshCw size={16} className="text-primary" />
                    <h3 className="card-title" style={{ fontSize: '15px', margin: 0 }}>Strategy Plan</h3>
                  </div>
                  
                  <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
                    {groupedSlots.map(group => group.slots.length > 0 && (
                      <div key={group.day_of_week} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '12px' }}>
                        <div style={{ fontSize: '10px', fontWeight: '900', color: 'var(--text-tertiary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          {group.day}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {group.slots.map(s => {
                            const timeLabel = s.time_label || `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`
                            return (
                              <div 
                                key={s.id} 
                                className="glass-card"
                                style={{ 
                                  padding: '6px 12px', 
                                  borderRadius: '8px', 
                                  fontSize: '11px', 
                                  fontWeight: '800', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '8px',
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.05)',
                                  color: 'var(--text-secondary)'
                                }}
                              >
                                <span style={{ color: 'var(--primary)', opacity: 0.8 }}>●</span>
                                {timeLabel}
                                <button
                                  onClick={() => handleDeleteSlot(s.id)}
                                  style={{ 
                                    background: 'transparent', 
                                    border: 'none', 
                                    padding: '2px', 
                                    marginLeft: '4px',
                                    color: 'var(--danger)',
                                    opacity: 0.4,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'opacity 0.2s'
                                  }}
                                  onMouseOver={e => e.currentTarget.style.opacity = '1'}
                                  onMouseOut={e => e.currentTarget.style.opacity = '0.4'}
                                >
                                  <TrashIcon size={12} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Liquid Glass Modal */}
        {editVideo && (
          <div className="modal-backdrop" style={{ 
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, 
            display: 'flex', alignItems: 'center', justifyContent: 'center' 
          }}>
            <div className="glass-panel fade-up" style={{ 
              maxWidth: '500px', width: '90%', padding: 'var(--space-8)', 
              position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' 
            }}>
              <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: '16px', right: '16px' }} onClick={() => setEditVideo(null)}>✕</button>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: 'var(--space-8)' }}>Optimize Schedule</h2>
              
              <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
                <div className="form-group">
                  <label className="form-label">Asset Identity</label>
                  <input className="form-input" value={editVideo.title} onChange={e => setEditVideo({ ...editVideo, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contextual Meta</label>
                  <textarea className="form-textarea" value={editVideo.description || ''} onChange={e => setEditVideo({ ...editVideo, description: e.target.value })} style={{ minHeight: '80px' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label">Release Matrix</label>
                    <input type="datetime-local" className="form-input" value={editVideo.scheduled_at ? editVideo.scheduled_at.slice(0,16) : ''} onChange={e => setEditVideo({ ...editVideo, scheduled_at: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Visibility</label>
                    <select className="form-select" value={editVideo.privacy || 'public'} onChange={e => setEditVideo({ ...editVideo, privacy: e.target.value })}>
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: 'var(--space-4)' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={editLoading} onClick={async () => {
                    setEditLoading(true)
                    try {
                      await updateVideo(editVideo.id, {
                        title: editVideo.title,
                        description: editVideo.description,
                        tags: editVideo.tags,
                        privacy: editVideo.privacy,
                        scheduled_at: editVideo.scheduled_at ? new Date(editVideo.scheduled_at).toISOString() : null,
                      })
                      setEditVideo(null)
                      await load()
                    } catch (e) { toast.error('Sync failed') }
                    setEditLoading(false)
                  }}>Apply Changes</button>
                  <button className="btn btn-danger" disabled={editLoading} onClick={async () => {
                    if (!window.confirm('Erase this asset?')) return
                    setEditLoading(true)
                    try {
                      await deleteVideo(editVideo.id)
                      setEditVideo(null)
                      await load()
                    } catch (e) { toast.error('Erasure failed') }
                    setEditLoading(false)
                  }}><TrashIcon size={16} /></button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>

  )
}

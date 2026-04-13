import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'
import { schedulerService } from '../modules/scheduler/scheduler.service'
import toast from 'react-hot-toast'
import { Trash2, BotMessageSquare, Zap, Clock3, Calendar, Loader2 } from 'lucide-react'

type SchedulerRule = {
  id: string
  weekday: number
  time_local: string
  timezone: string
  active: boolean
}

type CalendarItem = {
  id: string
  title: string
  scheduled_at?: string | null
  status: 'draft' | 'scheduled' | 'published' | 'failed'
}

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function AutomationPage() {
  const [rules, setRules] = useState<SchedulerRule[]>([])
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(false)
  const [weekday, setWeekday] = useState(1)
  const [timeLocal, setTimeLocal] = useState('18:00')
  const [timezone, setTimezone] = useState('UTC')
  const [count, setCount] = useState(10)
  const [autofilling, setAutofilling] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [r, c] = await Promise.all([schedulerService.listRules(), schedulerService.listCalendar()])
      setRules(r)
      setCalendarItems(c)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load automation data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function addRule() {
    try {
      await schedulerService.createRule({
        weekday: Number(weekday),
        time_local: timeLocal,
        timezone: timezone.trim() || 'UTC',
        active: true,
      })
      toast.success('Recurring rule added')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to add rule')
    }
  }

  async function removeRule(id: string) {
    try {
      await schedulerService.deleteRule(id)
      toast.success('Rule removed')
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to remove rule')
    }
  }

  async function autoFill() {
    setAutofilling(true)
    try {
      const res = await schedulerService.autoFillQueue(Number(count))
      toast.success(`Queued ${res.queued || 0} posts`)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Autofill failed')
    } finally {
      setAutofilling(false)
    }
  }

  return (
    <>
      <Topbar 
        title="Protocol Automation" 
        subtitle="Configure recurring distribution cycles and intelligent queue preservation" 
        actions={null}
        filters={null}
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          <div className="two-col align-start" style={{ gap: 'var(--space-8)' }}>
            
            {/* Recurring Rules */}
            <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-8)' }}>
                <div style={{ padding: '10px', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}>
                  <BotMessageSquare size={20} />
                </div>
                <div>
                  <h3 className="card-title">Recurring Sequence</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Temporal distribution protocols</p>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label">Sequence Day</label>
                    <select className="form-select" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                      {WEEKDAYS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temporal Slot</label>
                    <input className="form-input" type="time" value={timeLocal} onChange={(e) => setTimeLocal(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reference Timezone</label>
                  <input className="form-input" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC" />
                </div>

                <button className="btn btn-primary" onClick={addRule} style={{ height: '44px' }}>
                  <BotMessageSquare size={16} /> Integrate Protocol
                </button>
              </div>

              <div style={{ marginTop: '32px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', marginBottom: '16px', textTransform: 'uppercase' }}>Active Protocols</div>
                {loading ? (
                  <div className="empty-state" style={{ padding: '40px 0' }}><Loader2 size={24} className="spin" /></div>
                ) : rules.length === 0 ? (
                  <div className="empty-state" style={{ padding: '40px 0' }}>
                    <Clock3 size={24} style={{ opacity: 0.2 }} />
                    <p style={{ fontSize: '13px' }}>No active protocols programmed</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {rules.map((r) => (
                      <div key={r.id} className="glass-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                            {WEEKDAYS.find((d) => d.value === Number(r.weekday))?.label || r.weekday} @ {r.time_local}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                            {r.timezone} · STATUS: {r.active ? 'NOMINAL' : 'SUSPENDED'}
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-xs" onClick={() => removeRule(r.id)} style={{ color: 'var(--danger)' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Queue Autofill */}
            <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-8)' }}>
                <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: '#60a5fa' }}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="card-title">Intelligent Autofill</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Automated queue population logic</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Sequence Depth (Posts)</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={100}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  />
                </div>
                <button className="btn btn-secondary" onClick={autoFill} disabled={autofilling} style={{ alignSelf: 'flex-end', height: '40px' }}>
                  {autofilling ? <Loader2 size={16} className="spin" /> : <Zap size={16} />} Execute Fill
                </button>
              </div>

              <div style={{ marginTop: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Upcoming Sequence</div>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)' }}>{calendarItems.length} ITEMS</div>
                </div>
                
                <div style={{ display: 'grid', gap: '8px' }}>
                  {calendarItems.slice(0, 8).map((item) => (
                    <div key={item.id} className="glass-card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title || 'Untitled Operation'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                          {item.scheduled_at ? new Date(item.scheduled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'PENDING T-CLOCK'}
                        </div>
                      </div>
                      <span className={`badge badge-${item.status === 'published' ? 'success' : item.status === 'scheduled' ? 'warning' : item.status === 'failed' ? 'danger' : 'info'}`} style={{ fontSize: '10px' }}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                  {!calendarItems.length && (
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <Calendar size={28} style={{ opacity: 0.1 }} />
                      <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Sequence queue empty</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

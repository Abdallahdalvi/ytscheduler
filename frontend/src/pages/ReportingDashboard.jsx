import { useState, useEffect } from 'react'
import { FileText, Play, ExternalLink, Download, RefreshCw, Zap, CheckCircle, Clock, AlertCircle, Loader } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_URL || ''

const STATUS_ICONS = {
  done:       <CheckCircle size={14} className="text-success" />,
  running:    <Loader size={14} className="text-primary spin" />,
  queued:     <Clock size={14} className="text-warning" />,
  failed:     <AlertCircle size={14} className="text-danger" />,
}

const STATUS_LABELS = {
  done:    'Done',
  running: 'Generating…',
  queued:  'Queued',
  failed:  'Failed',
}

export default function ReportingDashboard({ authStatus }) {
  const [reports, setReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [gensparkConnected, setGensparkConnected] = useState(false)
  const [connectingGenspark, setConnectingGenspark] = useState(false)
  const [generatingNow, setGeneratingNow] = useState(false)
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [reportType, setReportType] = useState('WEEKLY')
  const [activeJobId, setActiveJobId] = useState(null)
  const [jobLogs, setJobLogs] = useState([])

  useEffect(() => {
    fetchReports()
    checkGensparkStatus()
    fetchAutoSetting()
  }, [])

  // Poll active job
  useEffect(() => {
    if (!activeJobId) return
    const eventSource = new EventSource(`${API_BASE}/api/report-job/logs/${activeJobId}`)
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setJobLogs(prev => [...prev, data])
      if (data.type === 'done' || data.type === 'error') {
        eventSource.close()
        setGeneratingNow(false)
        setActiveJobId(null)
        fetchReports()
      }
    }
    eventSource.onerror = () => eventSource.close()
    return () => eventSource.close()
  }, [activeJobId])

  async function fetchReports() {
    try {
      setLoadingReports(true)
      const res = await axios.get(`${API_BASE}/api/reports`)
      setReports(res.data.reports || [])
    } catch {
      setReports([])
    } finally {
      setLoadingReports(false)
    }
  }

  async function checkGensparkStatus() {
    try {
      const res = await axios.get(`${API_BASE}/api/genspark/status`)
      setGensparkConnected(res.data.connected)
    } catch {
      setGensparkConnected(false)
    }
  }

  async function fetchAutoSetting() {
    try {
      const res = await axios.get(`${API_BASE}/api/reports/settings`)
      setAutoEnabled(res.data.autoReporting ?? false)
      setReportType(res.data.reportType ?? 'WEEKLY')
    } catch {}
  }

  async function connectGenspark() {
    setConnectingGenspark(true)
    try {
      const res = await axios.post(`${API_BASE}/api/genspark/connect`)
      if (res.data.ok) {
        toast.success('GenSpark browser session opened — log in and close the window.')
        // Poll until connected
        const poll = setInterval(async () => {
          const s = await axios.get(`${API_BASE}/api/genspark/status`)
          if (s.data.connected) {
            setGensparkConnected(true)
            clearInterval(poll)
            toast.success('GenSpark connected!')
          }
        }, 3000)
      }
    } catch (e) {
      toast.error('Failed to open GenSpark browser')
    } finally {
      setConnectingGenspark(false)
    }
  }

  async function generateNow() {
    if (!authStatus?.connected) {
      toast.error('Connect a YouTube channel first!')
      return
    }
    if (!gensparkConnected) {
      toast.error('Connect your GenSpark account first!')
      return
    }
    setGeneratingNow(true)
    setJobLogs([])
    try {
      const today = new Date()
      const endDate = today.toISOString().split('T')[0]
      const startDate = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0]
      const res = await axios.post(`${API_BASE}/api/reports/generate`, { reportType, startDate, endDate })
      setActiveJobId(res.data.jobId)
      toast.success('Report generation started!')
    } catch (e) {
      toast.error('Failed to start report')
      setGeneratingNow(false)
    }
  }

  async function toggleAutoReporting() {
    try {
      const next = !autoEnabled
      await axios.post(`${API_BASE}/api/reports/settings`, { autoReporting: next, reportType })
      setAutoEnabled(next)
      toast.success(next ? 'Monthly auto-reports enabled!' : 'Auto-reports disabled')
    } catch {
      toast.error('Failed to update setting')
    }
  }

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Autopilot Reports</h1>
          <p className="page-subtitle">Automated AI-powered YouTube analytics presentations via GenSpark</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={generateNow}
          disabled={generatingNow || !authStatus?.connected}
        >
          {generatingNow
            ? <><Loader size={16} className="spin" /> Generating…</>
            : <><Play size={16} /> Generate Now</>}
        </button>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* GenSpark Connection Card */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: gensparkConnected ? 'rgba(34,197,94,0.1)' : 'var(--surface-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color={gensparkConnected ? 'var(--success)' : 'var(--text-tertiary)'} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>GenSpark Account</div>
              <div style={{ fontSize: '11px', color: gensparkConnected ? 'var(--success)' : 'var(--text-tertiary)' }}>
                {gensparkConnected ? '● Connected & ready' : '○ Not connected'}
              </div>
            </div>
          </div>
          {gensparkConnected ? (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px' }}>
              ✅ Session saved. Reports will generate automatically in the background (headless mode).
            </div>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              style={{ width: '100%' }}
              onClick={connectGenspark}
              disabled={connectingGenspark}
            >
              {connectingGenspark ? <><Loader size={14} className="spin" /> Opening…</> : 'Connect GenSpark Account'}
            </button>
          )}
        </div>

        {/* Auto-Reporting Settings Card */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Monthly Auto-Reports</div>
            <button
              className={`btn btn-sm ${autoEnabled ? 'btn-danger' : 'btn-primary'}`}
              onClick={toggleAutoReporting}
            >
              {autoEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            {autoEnabled
              ? '🎯 Active — A new presentation will be auto-generated on the 1st of every month.'
              : 'Enable to auto-generate a presentation on the 1st of every month.'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Report Type</label>
            <select
              className="input input-sm"
              value={reportType}
              style={{ flex: 1, fontSize: '12px' }}
              onChange={e => setReportType(e.target.value)}
            >
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Live Job Logs */}
      {(generatingNow || jobLogs.length > 0) && (
        <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader size={14} className={generatingNow ? 'spin' : ''} />
            Live Generation Log
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', maxHeight: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }}>
            {jobLogs.map((log, i) => (
              <div key={i} style={{ color: log.type === 'error' ? 'var(--danger)' : log.type === 'success' ? 'var(--success)' : 'var(--text-secondary)' }}>
                {log.message}
              </div>
            ))}
            {generatingNow && <div style={{ color: 'var(--text-tertiary)' }}>⏳ Working…</div>}
          </div>
        </div>
      )}

      {/* Reports History */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} /> Report History
          </div>
          <button className="btn btn-ghost btn-xs" onClick={fetchReports}>
            <RefreshCw size={13} />
          </button>
        </div>

        {loadingReports ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
            <Loader size={24} className="spin" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '13px' }}>Loading reports…</div>
          </div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-tertiary)' }}>
            <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>No reports yet</div>
            <div style={{ fontSize: '12px' }}>Click "Generate Now" to create your first AI presentation.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reports.map((r) => (
              <div key={r.id} className="glass-panel" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface-secondary)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>
                    {r.report_type} Report — {r.period_start} → {r.period_end}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Generated {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {STATUS_ICONS[r.status]}
                  {STATUS_LABELS[r.status] || r.status}
                </div>
                {r.presentation_url && (
                  <a
                    href={r.presentation_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary btn-xs"
                    style={{ textDecoration: 'none' }}
                  >
                    <ExternalLink size={12} /> View Slides
                  </a>
                )}
                {r.csv_folder && (
                  <button className="btn btn-ghost btn-xs" title="Download CSVs">
                    <Download size={12} /> CSVs
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

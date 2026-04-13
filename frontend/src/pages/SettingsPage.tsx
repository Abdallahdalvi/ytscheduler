import { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '../api'
import Topbar from '../components/Topbar'
import { Key, Settings2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage({ authStatus }: { authStatus: any }) {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [aiModel, setAiModel] = useState('google/gemma-4-31b-it:free')
  const [privacy, setPrivacy]   = useState('public')
  const [autoFill, setAutoFill] = useState(true)
  const [saved, setSaved]       = useState(false)
  const [timeZone, setTimeZone] = useState('Asia/Kolkata')

  async function load() {
    try {
      const sRes = await getSettings()
      const s = sRes.data
      setSettings(s)
      setPrivacy(s.default_privacy || 'public')
      setAutoFill(s.auto_fill_slots !== false)
      setAiModel(s.ai_model || 'google/gemma-4-31b-it:free')
      setTimeZone(s.time_zone || 'Asia/Kolkata')
    } catch {}
  }
  useEffect(() => { load() }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await updateSettings({
        default_privacy: privacy,
        auto_fill_slots: autoFill,
        ai_model: aiModel,
        time_zone: timeZone,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      toast.success('Settings saved!')
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  return (
    <>
      <Topbar 
        title="Infrastructure Control" 
        subtitle="Orchestrate your API integrations and global deployment parameters"
        actions={null}
        filters={null}
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-8)' }}>
            
            {/* API Synthesis Layer */}
            <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-8)' }}>
                <div style={{ padding: '10px', background: 'rgba(var(--primary-rgb), 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                  <Key size={20} />
                </div>
                <h3 className="card-title">Cognitive Access</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                
                {/* OAuth Status Card */}
                <div className="glass-card" style={{ 
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
                  background: settings?.has_client_secret ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                  border: settings?.has_client_secret ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '16px',
                    background: settings?.has_client_secret ? 'var(--green)' : 'var(--danger)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                  }}>
                    {settings?.has_client_secret ? <CheckCircle2 size={18} /> : <span>!</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: settings?.has_client_secret ? '#fff' : 'var(--danger)' }}>
                      Identity Descriptor: {settings?.has_client_secret ? 'LOADED' : 'NOT DETECTED'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {settings?.has_client_secret ? 'Google OAuth2 protocols synchronized.' : 'Place client_secret.json in system root.'}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Neural Engine Selection</label>
                  <select className="form-select" value={aiModel} onChange={e => setAiModel(e.target.value)}>
                    <option value="openai/gpt-5.4">OpenAI: GPT-5.4 (Core Strategic Engine)</option>
                    <option value="openai/gpt-5.4-mini">OpenAI: GPT-5.4 Mini (Lightweight Auditor)</option>
                    <option value="google/gemini-3-flash-preview">Google: Gemini 3 Flash Preview</option>
                    <option value="google/gemma-4-31b-it:free">Google: Gemma 4 31B (Free Tier)</option>
                    <option value="x-ai/grok-4.1-fast">xAI: Grok 4.1 Fast (Real-Time Insight)</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Parameter Synchronization */}
            <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-8)' }}>
                <div style={{ padding: '10px', background: 'rgba(var(--primary-rgb), 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                  <Settings2 size={20} />
                </div>
                <h3 className="card-title">Preference Logic</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div className="form-group">
                  <label className="form-label">Default Broadcast Visibility</label>
                  <select className="form-select" value={privacy} onChange={e => setPrivacy(e.target.value)}>
                    <option value="public">Global Public</option>
                    <option value="unlisted">Unlisted Protocol</option>
                    <option value="private">Restricted Access</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Temporal Context (Time Zone)</label>
                  <select className="form-select" value={timeZone} onChange={e => setTimeZone(e.target.value)}>
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="UTC">Universal Time (UTC)</option>
                    <option value="America/New_York">US East (EST)</option>
                    <option value="Europe/London">London (GMT)</option>
                  </select>
                </div>

                <label className="glass-card" style={{ 
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', 
                  cursor: 'pointer', transition: 'background 0.2s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={autoFill}
                    onChange={e => setAutoFill(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>Autonomous Pipeline Management</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Auto-fill distribution slots upon asset ingestion.</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', maxWidth: '300px', height: '54px', fontSize: '16px', fontWeight: '800' }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <span className="spinner" /> : (saved ? <CheckCircle2 size={18} /> : <Settings2 size={18} />)}
              <span style={{ marginLeft: '12px' }}>{saving ? 'Synchronizing...' : (saved ? 'State Saved' : 'Update Core Configuration')}</span>
            </button>

            {/* Onboarding Matrix */}
            <div className="glass-panel" style={{ padding: 'var(--space-8)', border: '1px solid rgba(var(--primary-rgb), 0.1)' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>Deployment Readiness Matrix</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {[
                  { label: 'Infrastructure Root Established', done: true },
                  { label: 'YouTube API v3 Interface Active', done: settings?.has_client_secret },
                  { label: 'Security descriptors loaded (client_secret)', done: settings?.has_client_secret },
                  { label: 'Neural node key authenticated (OpenRouter)', done: settings?.has_openrouter_key },
                  { label: 'Broadcast conduit synchronized (YouTube)', done: authStatus?.connected },
                ].map((item, i) => (
                  <div key={i} style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px', 
                    padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div style={{ 
                      width: '20px', height: '20px', borderRadius: '10px', 
                      background: item.done ? 'var(--green)' : 'rgba(255,255,255,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {item.done && <CheckCircle2 size={12} color="#fff" />}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: item.done ? 'var(--text-secondary)' : 'var(--text-quaternary)' }}>
                      {item.label}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

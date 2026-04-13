import { useState } from 'react'
import { generateCaption } from '../api'
import Topbar from '../components/Topbar'
import { Sparkles, Copy, Check, RefreshCw, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const TONES = [
  { key: 'casual',       label: '😊 Casual',       desc: 'Friendly & relatable' },
  { key: 'professional', label: '💼 Professional',  desc: 'Authoritative & clear' },
  { key: 'viral',        label: '🔥 Viral',         desc: 'Exciting & hook-driven' },
  { key: 'educational',  label: '📚 Educational',   desc: 'Informative & structured' },
]

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  async function doCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className="btn btn-ghost btn-sm" onClick={doCopy} title="Copy">
      {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
    </button>
  )
}

export default function CaptionsPage({ authStatus }: { authStatus: any }) {
  const [title, setTitle]     = useState('')
  const [extra, setExtra]     = useState('')
  const [tone, setTone]       = useState('casual')
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)

  function extractErrorMessage(err: any) {
    return (
      err?.response?.data?.error?.message ||
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      'Caption generation failed'
    )
  }

  async function handleGenerate() {
    if (!title.trim()) return toast.error('Enter a video title first')
    setLoading(true)
    try {
      const res = await generateCaption({ prompt: title, title, tone, extra_context: extra })
      setResult(res.data)
      toast.success('Caption generated!')
    } catch (e) {
      toast.error('Generation failed: ' + extractErrorMessage(e))
    }
    setLoading(false)
  }

  return (
    <>
      <Topbar
        title="AI Creative Engine"
        subtitle="Unleash generative potential for captions, metadata, and viral hooks"
        actions={null}
        filters={null}
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          <div className="two-col" style={{ alignItems: 'start', gap: 'var(--space-8)' }}>
            
            {/* Input Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
              <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-6)' }}>
                  <div style={{ padding: '10px', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}>
                    <Sparkles size={20} />
                  </div>
                  <h3 className="card-title">Cognitive Context</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                  <div className="form-group">
                    <label className="form-label">Objective Title *</label>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: '100px' }}
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. 10 Secret productivity hacks using liquid glass..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Narrative Topology</label>
                    <div className="tone-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {TONES.map(t => (
                        <button
                          key={t.key}
                          className={`glass-card tone-btn${tone === t.key ? ' active' : ''}`}
                          onClick={() => setTone(t.key)}
                          type="button"
                          style={{
                            padding: '12px',
                            textAlign: 'left',
                            border: tone === t.key ? '1px solid var(--primary)' : '1px solid transparent',
                            background: tone === t.key ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.01)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: '800' }}>{t.label}</div>
                          <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '2px' }}>{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', height: '50px', fontSize: '15px', fontWeight: '800' }}
                    onClick={handleGenerate}
                    disabled={loading}
                  >
                    {loading ? <span className="spinner" /> : <Sparkles size={18} />}
                    <span style={{ marginLeft: '10px' }}>{loading ? 'Synthesizing...' : 'Synthesize Insights'}</span>
                  </button>
                </div>
              </div>

              {/* Cognitive Tips */}
              <div className="glass-panel" style={{ padding: 'var(--space-6)', border: '1px solid var(--primary-light)' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Intelligence Matrix Tips</h4>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {[
                    'Rich descriptors yield high-fidelity output',
                    'Viral mode prioritizes retention hooks',
                    'Integrate brand tokens for consistency',
                    'Global styles derived from Gemini 1.5 Pro'
                  ].map((tip, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      <div style={{ color: 'var(--primary)', flexShrink: 0 }}>●</div>
                      {tip}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Result Panel */}
            <div style={{ width: '100%' }}>
              {!result ? (
                <div className="glass-panel" style={{ padding: '80px 40px', textAlign: 'center', opacity: 0.7 }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '40px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <Sparkles size={32} style={{ color: 'var(--text-quaternary)' }} />
                  </div>
                  <h3 className="card-title" style={{ marginBottom: '8px' }}>Neural Engine Idle</h3>
                  <p className="card-subtitle">Upload context triggers automated synthesis</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
                  
                  {/* Performance Forecast */}
                  {result.seo_score && (
                    <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ 
                        width: '64px', height: '64px', borderRadius: '32px', 
                        background: 'conic-gradient(var(--primary) 0%, rgba(255,255,255,0.05) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative'
                      }}>
                        <div style={{ 
                          width: '56px', height: '56px', borderRadius: '28px', 
                          background: 'var(--surface-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '18px', fontWeight: '900', color: '#fff'
                        }}>
                          {result.seo_score}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>SEO POTENTIAL</h4>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: result.seo_score >= 80 ? 'var(--green)' : 'var(--primary)' }}>
                          {result.seo_score >= 80 ? 'Exceptional Performance' : 'Optimized Stability'}
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={handleGenerate} disabled={loading}>
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  )}

                  {/* Narrative Options */}
                  {result.suggested_titles?.length > 0 && (
                    <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
                      <h4 style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Suggested Titles</h4>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {result.suggested_titles.map((t, i) => (
                          <div key={i} className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ flex: 1, fontSize: '13px', fontWeight: '700' }}>{t}</span>
                            <CopyButton text={t} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Core Description */}
                  <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Primary Description</h4>
                      <CopyButton text={result.description || ''} />
                    </div>
                    <div style={{ 
                      padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', 
                      fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6',
                      maxHeight: '400px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      {result.description}
                    </div>
                  </div>

                  {/* Metadata Tokens */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                    {result.tags?.length > 0 && (
                      <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h4 style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Search Tags</h4>
                          <CopyButton text={result.tags.join(', ')} />
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {result.tags.map((t, i) => <span key={i} className="badge badge-info" style={{ fontSize: '10px' }}>{t}</span>)}
                        </div>
                      </div>
                    )}

                    {result.hashtags?.length > 0 && (
                      <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h4 style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Social Hooks</h4>
                          <CopyButton text={result.hashtags.join(' ')} />
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {result.hashtags.map((h, i) => <span key={i} className="badge badge-primary" style={{ fontSize: '10px' }}>{h}</span>)}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>

  )
}

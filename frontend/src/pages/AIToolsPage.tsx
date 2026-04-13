import { useState } from 'react'
import { Zap, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Topbar from '../components/Topbar'
import { Card, CardHeader, CardBody, CardFooter } from '../components/Card'
import { FormField, FormInput, FormSection, FormTextarea } from '../components/FormField'
import { aiService } from '../modules/ai/ai.service'

type AiTagsResponse = { tags?: string[] }
type AiTitleResponse = { title: string }
type AiDescriptionResponse = { description: string }
type AiThumbResponse = { ideas?: string[] }
type SeoResult = {
  score: number
  strength: string
  reasons?: string[]
}

type AiResult = {
  title: AiTitleResponse
  description: AiDescriptionResponse
  tags: AiTagsResponse
  thumb: AiThumbResponse
}

function parseKeywords(input: string) {
  return input.split(',').map((value) => value.trim()).filter(Boolean)
}

function ResultEyebrow({ children }: { children: string }) {
  return <div className="result-eyebrow">{children}</div>
}

export default function AIToolsPage() {
  const [topic, setTopic] = useState('')
  const [keywordsInput, setKeywordsInput] = useState('')
  const [audience, setAudience] = useState('general creators')
  const [result, setResult] = useState<AiResult | null>(null)
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [seoTags, setSeoTags] = useState('')
  const [seoKeyword, setSeoKeyword] = useState('')
  const [seoResult, setSeoResult] = useState<SeoResult | null>(null)

  function basePayload() {
    return {
      topic: topic.trim(),
      keywords: parseKeywords(keywordsInput),
      audience: audience.trim() || 'general',
    }
  }

  async function runAll() {
    if (!topic.trim()) {
      toast.error('Topic is required')
      return
    }

    try {
      const payload = basePayload()
      const [title, description, tags, thumb] = await Promise.all([
        aiService.generateTitle(payload),
        aiService.generateDescription(payload),
        aiService.generateTags(payload),
        aiService.generateThumbnailText(payload),
      ])
      setResult({ title, description, tags, thumb })
      toast.success('AI content generated')
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'AI generation failed')
    }
  }

  async function runSeoScore() {
    if (!seoTitle.trim()) {
      toast.error('SEO title is required')
      return
    }

    try {
      const score = await aiService.seoScore({
        title: seoTitle,
        description: seoDescription,
        tags: parseKeywords(seoTags),
        keyword: seoKeyword,
      })
      setSeoResult(score)
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'SEO scoring failed')
    }
  }

  return (
    <>
      <Topbar
        title="Cognitive Enhancement Suite"
        subtitle="Generative protocols for metadata synthesis and semantic SEO optimization"
        actions={null}
        filters={null}
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          <div className="two-col align-start" style={{ gap: 'var(--space-8)' }}>
            
            {/* Generation Panel */}
            <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-8)' }}>
                <div style={{ padding: '10px', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}>
                  <Zap size={20} />
                </div>
                <h3 className="card-title">Synthesis Engine</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div className="form-group">
                  <label className="form-label">Core Objective (Topic) *</label>
                  <input 
                    className="form-input" 
                    placeholder="e.g. Liquid Glass Design Architecture" 
                    value={topic} 
                    onChange={(event) => setTopic(event.target.value)} 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Semantic Keywords (CSV)</label>
                  <input 
                    className="form-input" 
                    placeholder="glassmorphism, design, apple" 
                    value={keywordsInput} 
                    onChange={(event) => setKeywordsInput(event.target.value)} 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Demographic</label>
                  <input 
                    className="form-input" 
                    placeholder="UX Engineers, Designers" 
                    value={audience} 
                    onChange={(event) => setAudience(event.target.value)} 
                  />
                </div>

                <button className="btn btn-primary" style={{ height: '48px', fontWeight: '800' }} onClick={runAll}>
                  <Zap size={18} /> Synthesize Domain Content
                </button>
              </div>

              {result && (
                <div style={{ marginTop: 'var(--space-8)', display: 'grid', gap: 'var(--space-6)' }}>
                  <div className="glass-card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', marginBottom: '8px', textTransform: 'uppercase' }}>Optimized Title</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>{result.title.title}</div>
                  </div>

                  <div className="glass-card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase' }}>Descriptor Protocol</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{result.description.description}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', marginBottom: '12px', textTransform: 'uppercase' }}>Metadata Tokens</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(result.tags.tags || []).map((tag) => (
                        <span key={tag} className="badge badge-primary" style={{ fontSize: '10px' }}>#{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase' }}>Visual Hook Ideas</div>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {(result.thumb.ideas || []).map((idea) => (
                        <div key={idea} style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                          <span style={{ color: 'var(--primary)' }}>▸</span> {idea}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SEO Analysis Panel */}
            <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-8)' }}>
                <div style={{ padding: '10px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px', color: 'var(--green)' }}>
                  <CheckCircle2 size={20} />
                </div>
                <h3 className="card-title">SEO Auditor</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div className="form-group">
                  <label className="form-label">Draft Title</label>
                  <input className="form-input" placeholder="Enter your video title" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Full Description</label>
                  <textarea className="form-textarea" style={{ minHeight: '120px' }} placeholder="Enter your video description" value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Context Tags</label>
                    <input className="form-input" placeholder="seo, keywords" value={seoTags} onChange={(event) => setSeoTags(event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Primary Key</label>
                    <input className="form-input" placeholder="youtube" value={seoKeyword} onChange={(event) => setSeoKeyword(event.target.value)} />
                  </div>
                </div>

                <button className="btn btn-secondary" style={{ height: '48px', fontWeight: '800' }} onClick={runSeoScore}>
                  <CheckCircle2 size={18} /> Run Semantic Audit
                </button>
              </div>

              {seoResult && (
                <div style={{ marginTop: 'var(--space-8)', display: 'grid', gap: 'var(--space-6)' }}>
                  <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ 
                      width: '64px', height: '64px', borderRadius: '32px', 
                      background: 'conic-gradient(var(--green) 0%, rgba(255,255,255,0.05) 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <div style={{ 
                        width: '56px', height: '56px', borderRadius: '28px', 
                        background: 'var(--surface-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px', fontWeight: '900', color: '#fff'
                      }}>
                        {seoResult.score}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Audit Result</div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--green)' }}>{seoResult.strength}</div>
                    </div>
                  </div>

                  {seoResult.reasons?.length ? (
                    <div className="glass-card" style={{ padding: '16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-tertiary)', marginBottom: '16px', textTransform: 'uppercase' }}>Structural Recommendations</div>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        {seoResult.reasons.map((reason) => (
                          <div key={reason} style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--green)' }}>✓</span> {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

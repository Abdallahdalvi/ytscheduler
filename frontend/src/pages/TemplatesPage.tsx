import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import { Card, CardHeader, CardBody } from '../components/Card'
import { templatesService } from '../modules/templates/templates.service'
import { getPlaylists } from '../api'
import toast from 'react-hot-toast'
import { Pencil, Trash2, Check, X, ClipboardList, Loader2 } from 'lucide-react'

const CATEGORIES: Record<string, string> = {
  '1': 'Film & Animation', '2': 'Autos & Vehicles', '10': 'Music',
  '15': 'Pets & Animals', '17': 'Sports', '19': 'Travel & Events',
  '20': 'Gaming', '22': 'People & Blogs', '23': 'Comedy',
  '24': 'Entertainment', '25': 'News & Politics', '26': 'Howto & Style',
  '27': 'Education', '28': 'Science & Technology', '29': 'Nonprofits',
}

type TemplateDefaults = {
  name: string
  title_template?: string | null
  description_template?: string
  tags_template?: string[]
  category_id?: string | null
  privacy?: 'public' | 'unlisted' | 'private' | null
  playlist_id?: string | null
  auto_schedule?: boolean | null
  thumbnail_url?: string | null
  ai_prompt?: string | null
  branding_context?: string | null
}

export default function TemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  // Create form
  const [name, setName] = useState('')
  const [titleTemplate, setTitleTemplate] = useState('')
  const [descriptionTemplate, setDescriptionTemplate] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [privacy, setPrivacy] = useState('')
  const [playlistId, setPlaylistId] = useState('')
  const [autoSchedule, setAutoSchedule] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [brandingContext, setBrandingContext] = useState('')

  // Edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editTitleTemplate, setEditTitleTemplate] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editPrivacy, setEditPrivacy] = useState('')
  const [editPlaylistId, setEditPlaylistId] = useState('')
  const [editAutoSchedule, setEditAutoSchedule] = useState('')
  const [editThumbnailUrl, setEditThumbnailUrl] = useState('')
  const [editAiPrompt, setEditAiPrompt] = useState('')
  const [editBrandingContext, setEditBrandingContext] = useState('')

  async function load() {
    setLoading(true)
    try {
      setTemplates(await templatesService.list())
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  async function loadPlaylists() {
    try {
      const res = await getPlaylists()
      setPlaylists(res.data.playlists || [])
    } catch {
      setPlaylists([])
    }
  }

  useEffect(() => {
    load()
    loadPlaylists()
  }, [])

  function makePayload(data: {
    name: string
    titleTemplate: string
    descriptionTemplate: string
    tagsInput: string
    categoryId: string
    privacy: string
    playlistId: string
    autoSchedule: string
    thumbnailUrl: string
    aiPrompt: string
    brandingContext: string
  }): TemplateDefaults {
    return {
      name: data.name.trim(),
      title_template: data.titleTemplate.trim() || null,
      description_template: data.descriptionTemplate || '',
      tags_template: data.tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      category_id: data.categoryId || null,
      privacy: (data.privacy as 'public' | 'unlisted' | 'private') || null,
      playlist_id: data.playlistId || null,
      auto_schedule: data.autoSchedule === '' ? null : data.autoSchedule === 'true',
      thumbnail_url: data.thumbnailUrl.trim() || null,
      ai_prompt: data.aiPrompt.trim() || null,
      branding_context: data.brandingContext.trim() || null,
    }
  }

  async function createTemplate() {
    if (!name.trim()) return toast.error('Template name is required')
    setSaving(true)
    try {
      await templatesService.create(makePayload({
        name,
        titleTemplate,
        descriptionTemplate,
        tagsInput,
        categoryId,
        privacy,
        playlistId,
        autoSchedule,
        thumbnailUrl,
        aiPrompt,
        brandingContext,
      }))
      toast.success('Template created')
      setName('')
      setTitleTemplate('')
      setDescriptionTemplate('')
      setTagsInput('')
      setCategoryId('')
      setPrivacy('')
      setPlaylistId('')
      setAutoSchedule('')
      setThumbnailUrl('')
      setAiPrompt('')
      setBrandingContext('')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(tpl: any) {
    setEditId(tpl.id)
    setEditName(tpl.name)
    setEditTitleTemplate(tpl.title_template || '')
    setEditDesc(tpl.description_template || '')
    setEditTags((tpl.tags_template || []).join(', '))
    setEditCategoryId(tpl.category_id || '')
    setEditPrivacy(tpl.privacy || '')
    setEditPlaylistId(tpl.playlist_id || '')
    setEditAutoSchedule(typeof tpl.auto_schedule === 'boolean' ? String(tpl.auto_schedule) : '')
    setEditThumbnailUrl(tpl.thumbnail_url || '')
    setEditAiPrompt(tpl.ai_prompt || '')
    setEditBrandingContext(tpl.branding_context || '')
  }

  function cancelEdit() {
    setEditId(null)
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return toast.error('Name is required')
    setEditSaving(true)
    try {
      await templatesService.update(id, makePayload({
        name: editName,
        titleTemplate: editTitleTemplate,
        descriptionTemplate: editDesc,
        tagsInput: editTags,
        categoryId: editCategoryId,
        privacy: editPrivacy,
        playlistId: editPlaylistId,
        autoSchedule: editAutoSchedule,
        thumbnailUrl: editThumbnailUrl,
        aiPrompt: editAiPrompt,
        brandingContext: editBrandingContext,
      }))
      toast.success('Template updated')
      setEditId(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Update failed')
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    try {
      await templatesService.remove(id)
      toast.success('Template deleted')
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Delete failed')
    }
  }

  return (
    <>
      <Topbar 
        title="Protocol Templates" 
        subtitle="Programmable configuration presets for automated distribution sequences" 
        actions={null}
        filters={null}
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          <div className="two-col align-start" style={{ gap: 'var(--space-8)' }}>
            
            {/* Create Panel */}
            <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-8)' }}>
                <div style={{ padding: '8px', background: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary)' }}>
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h3 className="card-title">Define Protocol</h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Metadata preservation layer</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div className="form-group">
                  <label className="form-label">Protocol Identifier *</label>
                  <input className="form-input" placeholder="e.g. Standard Distribution Sequence" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Title Pattern (Optional)</label>
                  <input className="form-input" placeholder="e.g. {{Title}} - Official" value={titleTemplate} onChange={(e) => setTitleTemplate(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Descriptor Template</label>
                  <textarea className="form-textarea" rows={4} placeholder="Integrated description logic..." value={descriptionTemplate} onChange={(e) => setDescriptionTemplate(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Metadata Tags (CSV)</label>
                  <input className="form-input" placeholder="youtube, viral, sequence" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Cluster Classification</label>
                    <select className="form-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                      <option value="">Default Classification</option>
                      {Object.entries(CATEGORIES).map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Privacy Visibility</label>
                    <select className="form-select" value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
                      <option value="">Sequence Default</option>
                      <option value="public">Global (Public)</option>
                      <option value="unlisted">Link-Only (Unlisted)</option>
                      <option value="private">Isolated (Private)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Branding & Style Focus</label>
                  <textarea className="form-textarea" rows={2} placeholder="e.g. Always use professional news tone..." value={brandingContext} onChange={(e) => setBrandingContext(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">AI Neural Prompt Preset</label>
                  <textarea className="form-textarea" rows={3} placeholder="Extract details from this link: [URL]..." value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
                </div>

                <button className="btn btn-primary" onClick={createTemplate} disabled={saving} style={{ height: '48px', fontWeight: '800' }}>
                  {saving ? <Loader2 size={16} className="spin" /> : <ClipboardList size={16} />} Synthesize Template
                </button>
              </div>
            </div>

            {/* List Panel */}
            <div className="glass-panel" style={{ padding: 'var(--space-8)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
                <h3 className="card-title">Stored Protocols</h3>
                <span className="badge badge-primary" style={{ fontSize: '10px' }}>{templates.length} UNITS</span>
              </div>

              {loading ? (
                <div className="empty-state" style={{ padding: '40px 0' }}><Loader2 size={28} className="spin" /></div>
              ) : templates.length === 0 ? (
                <div className="empty-state" style={{ padding: '80px 0' }}>
                  <ClipboardList size={40} style={{ opacity: 0.1 }} />
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Neural database contains no presets</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
                  {templates.map((tpl) => (
                    <div key={tpl.id} className="glass-card" style={{ padding: 'var(--space-5)' }}>
                      {editId === tpl.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                          <input className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
                          <textarea className="form-textarea" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" rows={3} />
                          <textarea className="form-textarea" value={editBrandingContext} onChange={(e) => setEditBrandingContext(e.target.value)} placeholder="Branding..." rows={2} />
                          <textarea className="form-textarea" value={editAiPrompt} onChange={(e) => setEditAiPrompt(e.target.value)} placeholder="Neural Prompt..." rows={2} />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => saveEdit(tpl.id)} disabled={editSaving}>
                              {editSaving ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={cancelEdit}><X size={13} /></button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>{tpl.name}</div>
                            {tpl.description_template && (
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '12px' }}>
                                {tpl.description_template.slice(0, 100)}{tpl.description_template.length > 100 ? '...' : ''}
                              </p>
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {tpl.privacy && <span className="badge" style={{ fontSize: '9px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{tpl.privacy}</span>}
                              {tpl.category_id && <span className="badge" style={{ fontSize: '9px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{CATEGORIES[tpl.category_id] || tpl.category_id}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-ghost btn-xs" onClick={() => navigate('/schedule')} title="Execute">Execute</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => startEdit(tpl)}><Pencil size={12} /></button>
                            <button className="btn btn-ghost btn-xs" onClick={() => deleteTemplate(tpl.id)} style={{ color: 'var(--danger)' }}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

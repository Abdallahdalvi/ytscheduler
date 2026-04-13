import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'
import { Card, CardHeader, CardBody } from '../components/Card'
import { mediaService } from '../modules/media/media.service'
import toast from 'react-hot-toast'
import { Search, Image, Video, Copy, Trash2, FolderOpen, Loader2, Plus } from 'lucide-react'

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url)
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [url, setUrl] = useState('')
  const [uploadType, setUploadType] = useState('thumbnail')
  const [adding, setAdding] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await mediaService.list({ type: typeFilter || undefined, q: search || undefined })
      setItems(data)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load media')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [typeFilter])

  async function addMedia() {
    if (!url.trim()) return toast.error('Public URL is required')
    setAdding(true)
    try {
      await mediaService.upload({
        type: uploadType,
        public_url: url.trim(),
        storage_path: 'external',
        file_size_bytes: null,
      })
      setUrl('')
      toast.success('Media added')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Upload failed')
    } finally {
      setAdding(false)
    }
  }

  async function removeMedia(id: string) {
    if (!confirm('Delete this media item?')) return
    try {
      await mediaService.remove(id)
      toast.success('Deleted')
      setItems((prev) => prev.filter((m) => m.id !== id))
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Delete failed')
    }
  }

  function copyUrl(copyTarget: string) {
    navigator.clipboard.writeText(copyTarget).then(() => toast.success('URL copied!'))
  }

  const filtered = search
    ? items.filter((m) => m.public_url?.toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <>
      <Topbar 
        title="Asset Distribution Hub" 
        subtitle={`${items.length} semantic assets synchronized within the neural library`} 
        actions={null}
        filters={null}
      />
      <div className="page-body fade-up">
        {/* Add Asset Panel */}
        <div className="glass-panel" style={{ marginBottom: 'var(--space-8)', padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-6)' }}>
            <div style={{ padding: '8px', background: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary)' }}>
              <Plus size={18} />
            </div>
            <h3 className="card-title" style={{ fontSize: '16px' }}>Ingest Semantic Asset</h3>
          </div>
          <div className="media-add-row" style={{ gap: 'var(--space-4)', display: 'flex', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Resource URI (Public URL)</label>
              <input
                className="form-input"
                placeholder="https://cloud.assets.com/resource.jpg"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMedia()}
              />
            </div>
            <div className="form-group" style={{ width: '180px' }}>
              <label className="form-label">Asset Classification</label>
              <select className="form-select" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                <option value="thumbnail">Static Thumbnail</option>
                <option value="video">Motion Sequence (Video)</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={addMedia} disabled={adding} style={{ height: '40px', padding: '0 24px' }}>
              {adding ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Ingest
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass-panel" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-3) var(--space-4)' }}>
          <div className="media-filter-bar" style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', pointerEvents: 'none' }}
              />
              <input
                className="form-input"
                placeholder="Filter assets by URI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 44, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
              />
            </div>
            <select 
              className="form-select" 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)} 
              style={{ width: '200px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <option value="">All Architectures</option>
              <option value="thumbnail">Static Assets</option>
              <option value="video">Motion Sequences</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="glass-panel" style={{ padding: '80px 0' }}>
            <div className="empty-state"><Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} /><p>Synchronizing assets...</p></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel" style={{ padding: '80px 0' }}>
            <div className="empty-state">
              <FolderOpen size={48} style={{ color: 'rgba(255,255,255,0.05)', marginBottom: '20px' }} />
              <p style={{ fontSize: '16px', fontWeight: '600' }}>No assets detected in current cluster</p>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '8px' }}>Ingest a valid Resource URI to expand the library</p>
            </div>
          </div>
        ) : (
          <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
            {filtered.map((item) => (
              <div key={item.id} className="glass-card fade-up" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="media-preview" style={{ height: '180px', position: 'relative', background: 'rgba(0,0,0,0.2)' }}>
                  {item.type === 'thumbnail' && isImageUrl(item.public_url) ? (
                    <img src={item.public_url} alt="asset" className="media-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : item.type === 'thumbnail' ? (
                    <div className="media-icon-placeholder" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-quaternary)' }}>
                      <Image size={40} strokeWidth={1} />
                    </div>
                  ) : (
                    <div className="media-icon-placeholder" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-quaternary)' }}>
                      <Video size={40} strokeWidth={1} />
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                    <div className="badge badge-primary" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {item.type.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="media-info" style={{ padding: '16px' }}>
                  <div className="media-url" title={item.public_url} style={{ 
                    fontSize: '12px', color: 'var(--text-secondary)', 
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    fontFamily: 'monospace', background: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '4px'
                  }}>
                    {item.public_url}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: '700' }}>
                      {item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'PENDING'}
                    </div>
                    <div className="media-card-actions" style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-ghost btn-xs" style={{ background: 'rgba(255,255,255,0.03)' }} onClick={() => copyUrl(item.public_url)} title="Copy URI">
                        <Copy size={13} />
                      </button>
                      <button className="btn btn-ghost btn-xs" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--danger)' }} onClick={() => removeMedia(item.id)} title="Purge Asset">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

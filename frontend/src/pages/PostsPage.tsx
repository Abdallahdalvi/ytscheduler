import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import { Card, CardHeader, CardBody } from '../components/Card'
import { FormSelect } from '../components/FormField'
import { usePosts } from '../hooks/usePosts'
import { postsService } from '../modules/posts/posts.service'
import { Search, FilterX, Trash2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PostsPage() {
  const navigate = useNavigate()
  const { posts, loading, error, refresh } = usePosts()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sortBy, setSortBy] = useState('created_desc')
  const [selected, setSelected] = useState({})
  const [bulkDate, setBulkDate] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = [...posts]

    if (status !== 'all') {
      rows = rows.filter((p) => p.status === status)
    }

    if (q) {
      rows = rows.filter((p) => (
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      ))
    }

    switch (sortBy) {
      case 'created_asc':
        rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        break
      case 'scheduled_asc':
        rows.sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0))
        break
      case 'scheduled_desc':
        rows.sort((a, b) => new Date(b.scheduled_at || 0) - new Date(a.scheduled_at || 0))
        break
      default:
        rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }

    return rows
  }, [posts, search, status, sortBy])

  const selectedIds = Object.entries(selected)
    .filter(([, checked]) => checked)
    .map(([id]) => id)

  function toggle(id) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleAll() {
    if (selectedIds.length === filtered.length) {
      setSelected({})
    } else {
      const all = {}
      filtered.forEach((p) => (all[p.id] = true))
      setSelected(all)
    }
  }

  async function bulkDelete() {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} posts?`)) return

    try {
      await postsService.bulkDelete(selectedIds)
      toast.success(`Deleted ${selectedIds.length} posts`)
      setSelected({})
      refresh()
    } catch (err) {
      toast.error(err?.message || 'Bulk delete failed')
    }
  }

  async function bulkReschedule() {
    if (!selectedIds.length) return toast.error('Select at least one post')
    if (!bulkDate) return toast.error('Pick a date/time first')

    try {
      await postsService.bulkReschedule(selectedIds, new Date(bulkDate).toISOString())
      toast.success(`Rescheduled ${selectedIds.length} posts`)
      setSelected({})
      refresh()
    } catch (err) {
      toast.error(err?.message || 'Bulk reschedule failed')
    }
  }

  return (
    <>
      <Topbar 
        title="Content Management" 
        subtitle="Organize and track all your scheduled social media posts" 
        actions={
          <button className="btn btn-primary" onClick={() => navigate('/schedule')}>
            Open Upload Queue
          </button>
        }
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          {loading && (
            <div className="glass-panel" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
              <div className="flex-center">
                <span className="spinner" />
              </div>
            </div>
          )}

          {!!error && (
            <div className="alert alert-danger" style={{ marginBottom: 'var(--space-6)' }}>
              {error}
            </div>
          )}
          
          <div className="glass-panel" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
              <h3 className="card-title">Filter Engine</h3>
              {(search || status !== 'all') && (
                <button className="btn btn-ghost btn-xs" onClick={() => { setSearch(''); setStatus('all'); }}>
                  <FilterX size={14} /> Reset
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Search Library</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-quaternary)' }} />
                  <input 
                    className="form-input" 
                    placeholder="Keywords..."
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ paddingLeft: '40px' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <FormSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">Every status</option>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                </FormSelect>
              </div>

              <div className="form-group">
                <label className="form-label">Sorting</label>
                <FormSelect value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="created_desc">Newest First</option>
                  <option value="scheduled_desc">Upcoming</option>
                </FormSelect>
              </div>

              <div className="form-group">
                <label className="form-label">Bulk Sync</label>
                <input 
                  className="form-input" 
                  type="datetime-local" 
                  value={bulkDate} 
                  onChange={(e) => setBulkDate(e.target.value)} 
                />
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button className="btn btn-primary btn-sm" onClick={bulkReschedule}>
                  <Clock size={14} /> Reschedule ({selectedIds.length})
                </button>
                <button className="btn btn-danger btn-sm" onClick={bulkDelete}>
                  <Trash2 size={14} /> Delete Selected
                </button>
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 className="card-title">Repository Results</h3>
            </div>

            <div className="table-container" style={{ margin: '0' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ width: '60px', padding: '16px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.length === filtered.length && filtered.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th style={{ padding: '16px' }}>Content Information</th>
                    <th style={{ padding: '16px', width: '140px' }}>Workflow</th>
                    <th style={{ padding: '16px', width: '180px' }}>Timeline</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '16px' }}>
                        <input type="checkbox" checked={!!selected[p.id]} onChange={() => toggle(p.id)} />
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text)', fontSize: '15px' }}>{p.title}</div>
                        {p.description && (
                          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span className={`badge badge-${p.status}`} style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: '800' }}>{p.status}</span>
                      </td>
                      <td style={{ padding: '16px', fontSize: '13px' }}>
                        <div style={{ color: 'var(--text-secondary)' }}>
                           <Clock size={12} style={{ display: 'inline', marginRight: '6px', opacity: 0.5 }} />
                           {p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString() : 'Draft'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-quaternary)', marginTop: '2px' }}>Created {new Date(p.created_at).toLocaleDateString()}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ padding: '80px', textAlign: 'center', opacity: 0.5 }}>
                  <Search size={40} style={{ marginBottom: '16px' }} />
                  <div>No matching content found in repository.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>

  )
}

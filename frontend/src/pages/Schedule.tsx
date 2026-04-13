import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload, Film, RefreshCw, Zap,
  ChevronDown, ChevronUp, Sparkles, CheckCircle2
} from 'lucide-react'
import Topbar from '../components/Topbar'
import VideoItem from '../components/VideoItem'
import {
  listVideos, uploadVideoFile, autoFillQueue, getSettings, generateCaption,
  getPlaylists, createPlaylist, bulkUploadVideos, listDrafts, publishDraft, uploadThumbnail
} from '../api'
import { activityService } from '../modules/activity/activity.service'
import { templatesService } from '../modules/templates/templates.service'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { analyzeVideoSeo } from '../utils/seoScore'

const CATEGORIES = {
  "1": "Film & Animation", "2": "Autos & Vehicles", "10": "Music",
  "15": "Pets & Animals", "17": "Sports", "19": "Travel & Events",
  "20": "Gaming", "22": "People & Blogs", "23": "Comedy",
  "24": "Entertainment", "25": "News & Politics", "26": "Howto & Style",
  "27": "Education", "28": "Science & Technology", "29": "Nonprofits"
}

export default function Schedule({ authStatus, authLoading }) {
        // Carousel state for bulk editing
        const [bulkStep, setBulkStep] = useState(0)
      // Bulk file metadata state
      const [bulkMeta, setBulkMeta] = useState([])
    const [bulkFiles, setBulkFiles] = useState([])
    const [bulkUploading, setBulkUploading] = useState(false)
    const [bulkProgress, setBulkProgress] = useState([]) // Array of progress per file
    const [drafts, setDrafts] = useState([])

    async function loadDrafts() {
      try {
        const res = await listDrafts()
        setDrafts(res.data.drafts || [])
      } catch {}
    }
  const navigate = useNavigate()
  const [videos, setVideos] = useState([])
  const [settings, setSettings] = useState(null)
  const [activeTab, setActiveTab] = useState('queue')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const [form, setForm] = useState({
    title: '', description: '', tags: '', category_id: '22',
    privacy: 'public', schedule_mode: 'auto', manual_scheduled_at: '', playlist_id: ''
  })
  const [singleDetection, setSingleDetection] = useState<{ kind: 'short' | 'video' | 'unknown'; duration: number; width: number; height: number } | null>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [brandingContext, setBrandingContext] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  
  const [playlists, setPlaylists] = useState([])
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('')
  const [creatingPlaylist, setCreatingPlaylist] = useState(false)
  const [seoCheckEnabled, setSeoCheckEnabled] = useState(true)
  const [bulkSeoScores, setBulkSeoScores] = useState<Record<number, ReturnType<typeof analyzeVideoSeo>>>({})
  const previousStatusesRef = useRef<Record<string, string>>({})

  function extractErrorMessage(err: any, fallback = 'Caption generation failed') {
    return (
      err?.response?.data?.error?.message ||
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      fallback
    )
  }

  function classifyVideo(duration: number, width: number, height: number) {
    // Shorts heuristic: <= 60s and vertical/square frame.
    if (duration > 0 && duration <= 60 && height >= width) return 'short'
    if (duration > 0) return 'video'
    return 'unknown'
  }

  function detectVideoMeta(file: File) {
    return new Promise<{ kind: 'short' | 'video' | 'unknown'; duration: number; width: number; height: number }>((resolve) => {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'

      video.onloadedmetadata = () => {
        const duration = Number(video.duration || 0)
        const width = Number(video.videoWidth || 0)
        const height = Number(video.videoHeight || 0)
        URL.revokeObjectURL(url)
        resolve({ kind: classifyVideo(duration, width, height), duration, width, height })
      }

      video.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({ kind: 'unknown', duration: 0, width: 0, height: 0 })
      }

      video.src = url
    })
  }

  function extractVideoThumbnail(file: File) {
    return new Promise<File | null>((resolve) => {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'auto'
      video.muted = true
      video.playsInline = true

      let finished = false
      const finish = (result: File | null) => {
        if (finished) return
        finished = true
        URL.revokeObjectURL(url)
        resolve(result)
      }

      const captureFrame = () => {
        try {
          const width = Number(video.videoWidth || 0)
          const height = Number(video.videoHeight || 0)
          if (!width || !height) return finish(null)

          const maxWidth = 1280
          const scale = width > maxWidth ? maxWidth / width : 1
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(2, Math.round(width * scale))
          canvas.height = Math.max(2, Math.round(height * scale))

          const ctx = canvas.getContext('2d')
          if (!ctx) return finish(null)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          canvas.toBlob((blob) => {
            if (!blob) return finish(null)
            const baseName = file.name.replace(/\.[^/.]+$/, '')
            finish(new File([blob], `${baseName}_auto-thumb.jpg`, { type: 'image/jpeg' }))
          }, 'image/jpeg', 0.88)
        } catch {
          finish(null)
        }
      }

      video.onloadedmetadata = () => {
        const duration = Number(video.duration || 0)
        const target = duration > 0 ? Math.min(1, duration / 3) : 0
        if (target > 0) {
          video.currentTime = target
        } else {
          captureFrame()
        }
      }

      video.onseeked = () => captureFrame()
      video.onerror = () => finish(null)
      video.src = url
    })
  }

  async function loadVideos() {
    try {
      const res = await listVideos()
      setVideos(res.data.videos || [])
    } catch {}
  }
  async function loadSettings() {
    try {
      const res = await getSettings()
      setSettings(res.data)
      setForm(f => ({ ...f, privacy: res.data.default_privacy || 'public', category_id: res.data.default_category || '22' }))
    } catch {}
  }
  async function loadPlaylists() {
    if (authLoading || !authStatus?.connected) return
    try {
      const res = await getPlaylists()
      setPlaylists(res.data.playlists || [])
    } catch {}
  }
  async function loadTemplates() {
    try {
      const data = await templatesService.list()
      setTemplates(data || [])
    } catch {}
  }

  useEffect(() => { loadVideos(); loadSettings(); loadPlaylists(); loadDrafts(); loadTemplates() }, [authStatus, authLoading])

  // Keep queue/scheduled progress live without requiring manual refresh.
  useEffect(() => {
    if (authLoading || !authStatus?.connected) return

    const hasActiveUploads = videos.some(v => {
      const s = String(v.status || '').toLowerCase()
      return s === 'uploading' || s === 'scheduled' || s === 'queued'
    })

    const intervalMs = hasActiveUploads ? 2500 : 7000
    const timer = setInterval(() => {
      loadVideos()
      if (activeTab === 'queue') loadDrafts()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [authLoading, authStatus?.connected, videos, activeTab])

  useEffect(() => {
    if (!videos.length) return

    const prev = previousStatusesRef.current
    const next: Record<string, string> = {}

    videos.forEach((v) => {
      const id = String(v.id)
      const current = String(v.status || '')
      const previous = prev[id]

      if (current === 'failed' && previous && previous !== 'failed') {
        activityService.create({
          action: 'video.failed',
          post_id: id,
          metadata: {
            title: v.title || 'Untitled video',
            error_message: v.error_message || null,
            youtube_id: v.youtube_id || null,
          },
        }).catch(() => {})
      }

      next[id] = current
    })

    previousStatusesRef.current = next
  }, [videos])
  // Bulk upload handler

  // Custom file input ref for bulk upload
  const bulkInputRef = useCallback(node => {
    if (node) {
      node.onchange = e => {
        const files = Array.from(e.target.files)
        setBulkSeoScores({})
        setBulkFiles(prev => {
          const newFiles = files.filter(f => !prev.some(p => p.name === f.name && p.size === f.size))
          setBulkMeta(metaPrev => {
            const startIndex = metaPrev.length
            const appended = newFiles.map(f => {
              const cleanTitle = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim()
              return {
                title: cleanTitle,
                description: '',
                tags: '',
                category_id: '22',
                privacy: 'public',
                schedule_mode: 'auto',
                manual_scheduled_at: '',
                playlist_id: '',
                detected_kind: 'unknown',
                detected_duration: 0,
                detected_width: 0,
                detected_height: 0,
              }
            })

            newFiles.forEach((file, localIdx) => {
              detectVideoMeta(file).then((meta) => {
                setBulkMeta(prevMeta => prevMeta.map((item, idx) => (
                  idx === startIndex + localIdx
                    ? {
                        ...item,
                        detected_kind: meta.kind,
                        detected_duration: meta.duration,
                        detected_width: meta.width,
                        detected_height: meta.height,
                      }
                    : item
                )))
              })
            })

            return [...metaPrev, ...appended]
          })
          return [...prev, ...newFiles]
        })
      }
    }
  }, [])

  function removeBulkFile(idx) {
    setBulkFiles(files => files.filter((_, i) => i !== idx))
    setBulkMeta(meta => meta.filter((_, i) => i !== idx))
    setBulkSeoScores({})
  }

  async function handleBulkUpload() {
    if (!bulkFiles.length) return toast.error('Select files for bulk upload')

    setBulkUploading(true)
    setBulkProgress(Array(bulkFiles.length).fill(0))
    let successCount = 0
    let failedCount = 0
    let postNowRequested = 0
    let postNowStarted = 0
    let postNowSkipped = 0
    for (let i = 0; i < bulkFiles.length; i++) {
      const mode = bulkMeta[i]?.schedule_mode || 'auto'
      if (mode === 'post_now') postNowRequested += 1

      if ((bulkMeta[i]?.schedule_mode || 'auto') === 'manual' && !bulkMeta[i]?.manual_scheduled_at) {
        failedCount += 1
        setBulkProgress(prev => {
          const arr = [...prev]
          arr[i] = -1
          return arr
        })
        continue
      }

      const fd = new FormData()
      fd.append('files', bulkFiles[i])
      // Attach metadata for each file
      fd.append('meta', JSON.stringify([bulkMeta[i]]))
      try {
        const res = await bulkUploadVideos(fd, pct => setBulkProgress(prev => {
          const arr = [...prev]
          arr[i] = pct
          return arr
        }))

        postNowStarted += Number(res?.data?.post_now_started || 0)
        postNowSkipped += Number(res?.data?.post_now_skipped || 0)
        successCount += 1
      } catch {
        failedCount += 1
        setBulkProgress(prev => {
          const arr = [...prev]
          arr[i] = -1 // failed
          return arr
        })
      }
    }

    activityService.create({
      action: 'videos.bulk_uploaded',
      metadata: {
        total_files: bulkFiles.length,
        succeeded: successCount,
        failed: failedCount,
        post_now_requested: postNowRequested,
        post_now_started: postNowStarted,
        post_now_skipped: postNowSkipped,
      },
    }).catch(() => {})

    toast.success(`Bulk upload complete: ${successCount} succeeded, ${failedCount} failed`)
    if (postNowRequested > 0) {
      if (postNowSkipped > 0) {
        toast(`Post now summary: started ${postNowStarted}, skipped ${postNowSkipped} (channel not connected or auth missing)`)
      } else {
        toast.success(`Post now summary: started ${postNowStarted} upload(s)`)
      }
      setActiveTab('scheduled') // uploads show here
    } else if (successCount > 0) {
      // If we used any scheduled mode, go to scheduled tab
      const hasScheduled = bulkMeta.some(m => m.schedule_mode === 'auto' || m.schedule_mode === 'manual')
      if (hasScheduled) setActiveTab('scheduled')
    }

    setBulkFiles([])
    setBulkMeta([])
    setBulkSeoScores({})
    loadVideos()
    loadDrafts()
    setBulkUploading(false)
  }
  async function handlePublishDraft(id) {
    try {
      await publishDraft(id)
      const draft = drafts.find((d) => d.id === id)
      activityService.create({
        action: 'draft.published',
        post_id: String(id),
        metadata: { title: draft?.title || 'Untitled draft' },
      }).catch(() => {})
      toast.success('Draft published!')
      loadVideos()
      loadDrafts()
    } catch {
      toast.error('Failed to publish draft')
    }
  }

  async function handleCreatePlaylist() {
    if (!newPlaylistTitle.trim()) return toast.error('Enter a playlist title')
    setCreatingPlaylist(true)
    try {
      const res = await createPlaylist({ title: newPlaylistTitle, privacy: form.privacy })
      setPlaylists(prev => [res.data.playlist, ...prev])
      setForm(f => ({ ...f, playlist_id: res.data.playlist.id }))
      setNewPlaylistTitle('')
      setShowCreatePlaylist(false)
      toast.success('Playlist created!')
    } catch (e) {
      toast.error('Failed to create playlist')
    }
    setCreatingPlaylist(false)
  }

  const onDrop = useCallback(files => {
    if (!files[0]) return
    const file = files[0]
    setSelectedFile(file)
    detectVideoMeta(file).then(setSingleDetection)
    extractVideoThumbnail(file).then((thumb) => {
      if (thumb) {
        setThumbnailFile(thumb)
        setThumbnailUrl('')
      }
    })
    if (!form.title) {
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      setForm(f => ({ ...f, title: name }))
    }
    setShowForm(true)
  }, [form.title])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'] },
    multiple: false,
  })

  const singleSeo = useMemo(() => analyzeVideoSeo({
    title: form.title,
    description: form.description,
    tags: form.tags,
    isShort: singleDetection?.kind === 'short',
  }), [form.title, form.description, form.tags, singleDetection?.kind])

  function analyzeBulkSeoForAll() {
    const next: Record<number, ReturnType<typeof analyzeVideoSeo>> = {}
    bulkMeta.forEach((item: any, idx) => {
      next[idx] = analyzeVideoSeo({
        title: item?.title,
        description: item?.description,
        tags: item?.tags,
        isShort: item?.detected_kind === 'short',
      })
    })
    setBulkSeoScores(next)
    const lowCount = Object.values(next).filter((r) => r.score < 55).length
    if (lowCount > 0) {
      toast(`SEO analysis done: ${lowCount} video(s) need improvement.`)
    } else {
      toast.success('SEO analysis done: all videos are in good shape.')
    }
    return next
  }

  async function handleAiCaption() {
    const textToGen = aiPrompt.trim() || form.title;
    if (!textToGen) return toast.error('Enter a title or prompt first');
    if (settings && settings.has_openrouter_key === false) {
      // key is built-in, skip check
    }
    setAiLoading(true)
    try {
      const res = await generateCaption({ 
        prompt: textToGen, 
        title: form.title, 
        tone: 'casual',
        extra_context: brandingContext // Injected branding
      })
      const bestTitle = Array.isArray(res.data.suggested_titles) && res.data.suggested_titles[0]
        ? res.data.suggested_titles[0]
        : null
      setForm(f => ({
        ...f,
        title: bestTitle || f.title,
        description: res.data.description || f.description,
        tags: (res.data.tags || []).join(', '),
      }))
      toast.success('AI caption generated!')
    } catch (e) {
      const msg = extractErrorMessage(e)
      toast.error(msg)
    }
    setAiLoading(false)
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!selectedFile) return toast.error('Select a video file')
    if (!form.title) return toast.error('Enter a title')
    if (form.schedule_mode === 'manual' && !form.manual_scheduled_at) {
      return toast.error('Pick a manual schedule date/time')
    }

    setUploading(true)
    setUploadProgress(0)
    const fd = new FormData()
    fd.append('file', selectedFile)
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))

    try {
      const res = await uploadVideoFile(fd, pct => setUploadProgress(pct))
      const videoId = res?.data?.video?.id

      // Optional thumbnail upload from local file or public URL.
      // If user didn't set one manually, auto-extract from selected video file.
      let finalThumbFile = thumbnailFile
      if (!finalThumbFile && !thumbnailUrl.trim() && selectedFile) {
        finalThumbFile = await extractVideoThumbnail(selectedFile)
      }

      if (videoId && (finalThumbFile || thumbnailUrl.trim())) {
        try {
          const thumbForm = new FormData()
          if (finalThumbFile) {
            thumbForm.append('thumbnail', finalThumbFile)
          } else {
            const response = await fetch(thumbnailUrl.trim())
            if (!response.ok) {
              throw new Error('Failed to fetch thumbnail URL')
            }
            const blob = await response.blob()
            const mime = blob.type || 'image/jpeg'
            const ext = mime.split('/')[1] || 'jpg'
            const file = new File([blob], `thumb.${ext}`, { type: mime })
            thumbForm.append('thumbnail', file)
          }
          await uploadThumbnail(videoId, thumbForm)
        } catch {
          toast.error('Video uploaded, but thumbnail upload failed. You can set it later from Videos page.')
        }
      }

      activityService.create({
        action: 'video.uploaded',
        post_id: String(res?.data?.video?.id || ''),
        metadata: {
          title: form.title,
          status: res?.data?.video?.status || 'queued',
          schedule_mode: form.schedule_mode,
          template_id: selectedTemplateId || null,
          thumbnail_source: finalThumbFile ? 'file' : (thumbnailUrl.trim() ? 'url' : 'none'),
        },
      }).catch(() => {})

      toast.success('Video uploaded to queue!')
      setSelectedFile(null)
      setSingleDetection(null)
      setShowForm(false)
      setForm(f => ({ ...f, title: '', description: '', tags: '', playlist_id: '', schedule_mode: 'auto', manual_scheduled_at: '' }))
      setAiPrompt('')
      setBrandingContext('')
      setThumbnailFile(null)
      setThumbnailUrl('')
      setSelectedTemplateId('')
      loadVideos()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed')
    }
    setUploading(false)
  }

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => String(t.id) === String(templateId))
    if (!tpl) return
    setForm((prev) => ({
      ...prev,
      title: tpl.title_template?.trim() ? tpl.title_template : prev.title,
      description: typeof tpl.description_template === 'string' ? tpl.description_template : prev.description,
      tags: Array.isArray(tpl.tags_template) ? tpl.tags_template.join(', ') : (prev.tags || ''),
      category_id: tpl.category_id || prev.category_id,
      privacy: tpl.privacy || prev.privacy,
      playlist_id: tpl.playlist_id || prev.playlist_id,
      schedule_mode: typeof tpl.auto_schedule === 'boolean' ? (tpl.auto_schedule ? 'auto' : prev.schedule_mode) : prev.schedule_mode,
    }))
    if (typeof tpl.thumbnail_url === 'string') {
      setThumbnailUrl(tpl.thumbnail_url)
    }
    if (typeof tpl.ai_prompt === 'string') {
      setAiPrompt(tpl.ai_prompt)
    }
    if (typeof tpl.branding_context === 'string') {
      setBrandingContext(tpl.branding_context)
    }
    toast.success(`Template "${tpl.name}" applied`)
  }

  function applyTemplateToBulk(templateId: string, applyToAll = false) {
    const tpl = templates.find((t) => String(t.id) === String(templateId))
    if (!tpl) return

    const applyOne = (item) => ({
      ...item,
      title: tpl.title_template?.trim() ? tpl.title_template : item.title,
      description: typeof tpl.description_template === 'string' ? tpl.description_template : item.description,
      tags: Array.isArray(tpl.tags_template) ? tpl.tags_template.join(', ') : (item.tags || ''),
      category_id: tpl.category_id || item.category_id,
      privacy: tpl.privacy || item.privacy,
      playlist_id: tpl.playlist_id || item.playlist_id,
      schedule_mode: typeof tpl.auto_schedule === 'boolean' ? (tpl.auto_schedule ? 'auto' : item.schedule_mode) : item.schedule_mode,
    })

    setBulkMeta((prev) => prev.map((item, idx) => (applyToAll || idx === bulkStep ? applyOne(item) : item)))
    toast.success(applyToAll ? `Template "${tpl.name}" applied to all videos` : `Template "${tpl.name}" applied`)
  }

  function applyBulkScheduleModeToAll() {
    const current = bulkMeta[bulkStep]
    if (!current) return
    setBulkMeta((prev) => prev.map((item) => ({
      ...item,
      schedule_mode: current.schedule_mode || 'auto',
      manual_scheduled_at: (current.schedule_mode === 'manual') ? (current.manual_scheduled_at || '') : '',
    })))
    toast.success('Scheduling mode applied to all videos')
  }

  async function handleAutoFill() {
    try {
      const res = await autoFillQueue()
      activityService.create({
        action: 'videos.auto_scheduled',
        metadata: {
          assigned_count: Number(res?.data?.assigned_count || 0),
          slots: res?.data?.slots || [],
        },
      }).catch(() => {})
      toast.success(`✅ Auto-scheduled ${res.data.assigned_count} video(s)!`)
      loadVideos()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Auto-fill failed')
    }
  }

  const byStatus = (s) => videos.filter(v => String(v.status || '').toLowerCase() === s)

  const tabCounts = {
    queue: byStatus('queued').length,
    scheduled: byStatus('scheduled').length,
    published: byStatus('published').length,
    failed: byStatus('failed').length,
  }

  const tabVideos = {
    queue: byStatus('queued'),
    scheduled: [...byStatus('scheduled'), ...byStatus('uploading')],
    published: byStatus('published'),
    failed: byStatus('failed'),
  }[activeTab] || []

  if (authLoading) {
    return (
      <>
        <Topbar title="Upload & Queue" subtitle="Loading channel state" />
        <div className="page-body">
          <div className="flex-center page-loader">
            <span className="spinner" />
          </div>
        </div>
      </>
    )
  }

  if (!authStatus?.connected) {
    return (
      <>
        <Topbar title="Upload & Queue" subtitle="Schedule your YouTube videos" />
        <div className="page-body">
          <div className="alert alert-warning">
            <span>⚠️ Connect your YouTube channel first (sidebar → Connect YouTube)</span>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar
        title="Upload Queue"
        subtitle="Schedule and manage your YouTube videos"
        actions={
          <button className="btn btn-secondary" onClick={handleAutoFill}>
            <Zap size={16} /> Auto-Fill Slots
          </button>
        }
      />
      <div className="page-body fade-up">
        <div className="content-max-width">
          {/* Bulk Upload Section */}
          <div className="glass-panel" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                background: 'var(--primary-light)', 
                color: 'var(--primary)', 
                borderRadius: '20px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto var(--space-4)'
              }}>
                <Upload size={32} />
              </div>
              <h2 className="card-title" style={{ fontSize: '24px' }}>Bulk Upload</h2>
              <p className="card-subtitle">Upload and schedule multiple videos at once</p>
            </div>
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <input
              type="file"
              accept="video/*"
              multiple
              ref={bulkInputRef}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => document.querySelector('input[type="file"][multiple]').click()}
              disabled={bulkUploading}
            >
              <Upload size={16} /> Choose Files
            </button>
            <div className="dropzone-sub">Bulk upload and schedule many videos at once</div>
          </div>
          {bulkFiles.length > 0 && (
            <div style={{ marginBottom: 12, width: '100%', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>
                  Video {bulkStep + 1} of {bulkFiles.length}
                </span>
                <button className="btn btn-ghost btn-xs" style={{ color: 'var(--danger)' }} onClick={() => removeBulkFile(bulkStep)} disabled={bulkUploading}>Remove</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
                <div style={{ fontSize: 15, fontWeight: 500, textAlign: 'center' }}>{bulkFiles[bulkStep].name} ({(bulkFiles[bulkStep].size / 1024 / 1024).toFixed(1)} MB)</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`badge ${bulkMeta[bulkStep]?.detected_kind === 'short' ? 'badge-success' : 'badge-info'}`}>
                    Detected: {bulkMeta[bulkStep]?.detected_kind === 'short' ? 'Short' : bulkMeta[bulkStep]?.detected_kind === 'video' ? 'Video' : 'Analyzing...'}
                  </span>
                  {bulkMeta[bulkStep]?.detected_duration > 0 && (
                    <span className="badge badge-info">
                      {Math.round(Number(bulkMeta[bulkStep]?.detected_duration || 0))}s · {bulkMeta[bulkStep]?.detected_width || 0}x{bulkMeta[bulkStep]?.detected_height || 0}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Video Title *</label>
                  <input
                    className="form-input"
                    value={bulkMeta[bulkStep]?.title || ''}
                    onChange={e => setBulkMeta(meta => meta.map((m, i) => i === bulkStep ? { ...m, title: e.target.value } : m))}
                    placeholder="Enter the actual YouTube video title…"
                    required
                    disabled={bulkUploading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>AI Prompt (optional)</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: 80, flex: 1 }}
                      value={bulkMeta[bulkStep]?.aiPrompt || ''}
                      onChange={e => setBulkMeta(meta => meta.map((m, i) => i === bulkStep ? { ...m, aiPrompt: e.target.value } : m))}
                      placeholder="e.g. Write a funny Tiktok script about an air purifier..."
                      disabled={bulkUploading}
                    />
                    <button type="button" className="btn btn-secondary" style={{ marginTop: 2, flexShrink: 0 }}
                      onClick={async () => {
                        const textToGen = (bulkMeta[bulkStep]?.aiPrompt || bulkMeta[bulkStep]?.title || '').trim();
                        if (!textToGen) return toast.error('Enter a title or prompt first');
                        if (settings && settings.has_openrouter_key === false) {
                          // key is built-in, skip check
                        }
                        setAiLoading(true);
                        try {
                          const res = await generateCaption({ prompt: textToGen, title: bulkMeta[bulkStep]?.title || '', tone: 'casual' });
                          const bestTitle = Array.isArray(res.data.suggested_titles) && res.data.suggested_titles[0]
                            ? res.data.suggested_titles[0]
                            : null;
                          setBulkMeta(meta => meta.map((m, i) => i === bulkStep ? {
                            ...m,
                            title: bestTitle || m.title,
                            description: res.data.description || m.description,
                            tags: (res.data.tags || []).join(', ')
                          } : m));
                          toast.success('AI caption generated!');
                        } catch (e) {
                          const msg = extractErrorMessage(e);
                          toast.error(msg);
                        }
                        setAiLoading(false);
                      }}
                      disabled={aiLoading || bulkUploading}
                      title="Generate AI caption"
                    >
                      {aiLoading ? <span className="spinner" /> : <Sparkles size={16} />}
                    </button>
                  </div>
                  <div className="form-hint">Click ✨ to auto-write description & tags based on your prompt (falls back to Title if empty)</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    value={bulkMeta[bulkStep]?.description || ''}
                    onChange={e => setBulkMeta(meta => meta.map((m, i) => i === bulkStep ? { ...m, description: e.target.value } : m))}
                    placeholder="Video description…"
                    disabled={bulkUploading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Template (Optional)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                    >
                      <option value="">-- No Template --</option>
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => applyTemplateToBulk(selectedTemplateId, false)}
                      disabled={!selectedTemplateId}
                    >
                      Apply to This
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => applyTemplateToBulk(selectedTemplateId, true)}
                      disabled={!selectedTemplateId || bulkFiles.length < 2}
                    >
                      Apply to All
                    </button>
                  </div>
                  <div className="form-hint">Applies saved description + tags from Templates.</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Tags (comma-separated)</label>
                  <input
                    className="form-input"
                    value={bulkMeta[bulkStep]?.tags || ''}
                    onChange={e => setBulkMeta(meta => meta.map((m, i) => i === bulkStep ? { ...m, tags: e.target.value } : m))}
                    placeholder="tag1, tag2, tag3…"
                    disabled={bulkUploading}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={bulkMeta[bulkStep]?.category_id || '22'}
                      onChange={e => setBulkMeta(meta => meta.map((m, i) => i === bulkStep ? { ...m, category_id: e.target.value } : m))}
                      disabled={bulkUploading}
                    >
                      {Object.entries(CATEGORIES).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Privacy</label>
                    <select
                      className="form-select"
                      value={bulkMeta[bulkStep]?.privacy || 'public'}
                      onChange={e => setBulkMeta(meta => meta.map((m, i) => i === bulkStep ? { ...m, privacy: e.target.value } : m))}
                      disabled={bulkUploading}
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Playlist (Optional)</label>
                  {!showCreatePlaylist ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        className="form-select"
                        style={{ flex: 1 }}
                        value={bulkMeta[bulkStep]?.playlist_id || ''}
                        onChange={e => setBulkMeta(meta => meta.map((m, i) => i === bulkStep ? { ...m, playlist_id: e.target.value } : m))}
                        disabled={bulkUploading}
                      >
                        <option value="">-- No Playlist --</option>
                        {playlists.map(p => (
                          <option key={p.id} value={p.id}>{p.title} ({p.privacy})</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowCreatePlaylist(true)} disabled={bulkUploading}>Create New</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" style={{ flex: 1 }} value={newPlaylistTitle} onChange={e => setNewPlaylistTitle(e.target.value)} placeholder="New playlist title..." />
                      <button type="button" className="btn btn-primary" onClick={handleCreatePlaylist} disabled={creatingPlaylist || bulkUploading}>{creatingPlaylist ? '...' : 'Create'}</button>
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowCreatePlaylist(false); setNewPlaylistTitle(''); }} disabled={bulkUploading}>Cancel</button>
                    </div>
                  )}
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label className="form-label" style={{ margin: 0 }}>Schedule Mode</label>
                  <select
                    className="form-select"
                    value={bulkMeta[bulkStep]?.schedule_mode || 'auto'}
                    onChange={e => setBulkMeta(meta => meta.map((m, i) => i === bulkStep ? { ...m, schedule_mode: e.target.value } : m))}
                    disabled={bulkUploading}
                  >
                    <option value="post_now">Post now</option>
                    <option value="manual">Manual schedule</option>
                    <option value="auto">Auto schedule (from calendar slots)</option>
                  </select>

                  {(bulkMeta[bulkStep]?.schedule_mode || 'auto') === 'manual' && (
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={bulkMeta[bulkStep]?.manual_scheduled_at || ''}
                      onChange={e => setBulkMeta(meta => meta.map((m, i) => i === bulkStep ? { ...m, manual_scheduled_at: e.target.value } : m))}
                      disabled={bulkUploading}
                    />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={applyBulkScheduleModeToAll} disabled={bulkUploading || bulkFiles.length < 2}>
                      Apply Mode to All
                    </button>
                    <span className="form-hint" style={{ margin: 0 }}>Pick Post now all, Manual, or Auto by your calendar slots.</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                <button className="btn btn-secondary" type="button" onClick={() => setBulkStep(s => Math.max(0, s - 1))} disabled={bulkStep === 0 || bulkUploading}>Previous</button>
                <button className="btn btn-secondary" type="button" onClick={() => setBulkStep(s => Math.min(bulkFiles.length - 1, s + 1))} disabled={bulkStep === bulkFiles.length - 1 || bulkUploading}>Next</button>
              </div>
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button className="btn btn-primary" onClick={handleBulkUpload} disabled={bulkUploading || !bulkFiles.length}>
                  {bulkUploading ? 'Uploading…' : 'Start Bulk Upload'}
                </button>
              </div>
              {bulkUploading && (
                <div style={{ marginTop: 12 }}>
                  <div>Uploading... {bulkProgress[bulkStep] || 0}%</div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${bulkProgress[bulkStep] || 0}%` }} /></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drafts Management */}
        {drafts.length > 0 && (
          <div className="glass-panel" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Incomplete Drafts</h3>
            <div className="video-list">
              {drafts.map(d => (
                <div key={d.id} className="video-item" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600' }}>{d.title}</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>Created {new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => handlePublishDraft(d.id)}>Finalize</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Zone */}
        <div className="glass-panel" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
            <h3 className="card-title">Upload Video</h3>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowForm(f => !f)}
              style={{ display: selectedFile ? 'flex' : 'none' }}
            >
              {showForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {/* Dropzone */}
          {!selectedFile && (
            <div className={`dropzone${isDragActive ? ' active' : ''}`} {...getRootProps()}>
              <input {...getInputProps()} />
              <div className="dropzone-icon"><Film size={24} /></div>
              <div className="dropzone-title">
                {isDragActive ? 'Drop your video here' : 'Drag & drop your video'}
              </div>
              <div className="dropzone-sub">
                or click to browse · MP4, MOV, AVI, MKV, WebM supported
              </div>
              <button className="btn btn-primary" style={{ marginTop: 20 }} type="button">
                <Upload size={16} /> Choose File
              </button>
            </div>
          )}

          {/* File selected */}
          {selectedFile && (
            <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className="stat-icon purple"><Film size={18} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedFile.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`badge ${singleDetection?.kind === 'short' ? 'badge-success' : 'badge-info'}`}>
                    Detected: {singleDetection?.kind === 'short' ? 'Short' : singleDetection?.kind === 'video' ? 'Video' : 'Analyzing...'}
                  </span>
                  {singleDetection?.duration ? (
                    <span className="badge badge-info">
                      {Math.round(singleDetection.duration)}s · {singleDetection.width}x{singleDetection.height}
                    </span>
                  ) : null}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--danger)' }} onClick={() => { setSelectedFile(null); setSingleDetection(null); setShowForm(false) }}>Remove</button>
            </div>
          )}

          {/* Upload Form */}
          {selectedFile && showForm && (
            <form onSubmit={handleUpload}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Template (Optional)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                    >
                      <option value="">-- No Template --</option>
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => applyTemplate(selectedTemplateId)}
                      disabled={!selectedTemplateId}
                    >
                      Apply
                    </button>
                  </div>
                  <div className="form-hint">Applies saved descriptions and tags from your Templates library.</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Video Title *</label>
                  <input
                    className="form-input"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Enter the actual YouTube video title…"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>AI Prompt (optional)</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: 80, flex: 1 }}
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      placeholder="e.g. Write a funny Tiktok script about an air purifier..."
                    />
                    <button type="button" className="btn btn-secondary" style={{ marginTop: 2, flexShrink: 0 }} onClick={handleAiCaption} disabled={aiLoading} title="Generate AI caption">
                      {aiLoading ? <span className="spinner" /> : <Sparkles size={16} />}
                    </button>
                  </div>
                  <div className="form-hint">Click ✨ to auto-write description & tags based on your prompt (falls back to Title if empty)</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Video description…"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tags (comma-separated)</label>
                  <input
                    className="form-input"
                    value={form.tags}
                    onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                    placeholder="tag1, tag2, tag3…"
                  />
                </div>

                <div className="glass-card" style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <input type="checkbox" checked={seoCheckEnabled} onChange={(e) => setSeoCheckEnabled(e.target.checked)} />
                      Check SEO before queueing
                    </label>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: singleSeo.score >= 80 ? '#22c55e' : (singleSeo.score >= 65 ? '#3b82f6' : (singleSeo.score >= 50 ? '#f59e0b' : '#ef4444')),
                      background: 'rgba(59,130,246,0.12)',
                      borderRadius: 999,
                      padding: '2px 8px'
                    }}>
                      SEO {singleSeo.score} ({singleSeo.level})
                    </span>
                  </div>
                  {singleSeo.suggestions.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                      Tip: {singleSeo.suggestions[0]}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Thumbnail (Optional)</label>
                  <input
                    className="form-input"
                    value={thumbnailUrl}
                    onChange={e => setThumbnailUrl(e.target.value)}
                    placeholder="Thumbnail URL (https://...)"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="form-input"
                    onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                  />
                  <div className="form-hint">Choose a local image or provide a public image URL. Local file takes priority.</div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                      {Object.entries(CATEGORIES).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Privacy</label>
                    <select className="form-select" value={form.privacy} onChange={e => setForm(f => ({ ...f, privacy: e.target.value }))}>
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Playlist (Optional)</label>
                  {!showCreatePlaylist ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select className="form-select" style={{ flex: 1 }} value={form.playlist_id} onChange={e => setForm(f => ({ ...f, playlist_id: e.target.value }))}>
                        <option value="">-- No Playlist --</option>
                        {playlists.map(p => (
                          <option key={p.id} value={p.id}>{p.title} ({p.privacy})</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowCreatePlaylist(true)}>Create New</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" style={{ flex: 1 }} value={newPlaylistTitle} onChange={e => setNewPlaylistTitle(e.target.value)} placeholder="New playlist title..." />
                      <button type="button" className="btn btn-primary" onClick={handleCreatePlaylist} disabled={creatingPlaylist}>{creatingPlaylist ? '...' : 'Create'}</button>
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowCreatePlaylist(false); setNewPlaylistTitle(''); }}>Cancel</button>
                    </div>
                  )}
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label className="form-label" style={{ margin: 0 }}>Schedule Mode</label>
                  <select
                    className="form-select"
                    value={form.schedule_mode}
                    onChange={e => setForm(f => ({ ...f, schedule_mode: e.target.value }))}
                  >
                    <option value="post_now">Post now</option>
                    <option value="manual">Manual schedule</option>
                    <option value="auto">Auto schedule (from calendar slots)</option>
                  </select>

                  {form.schedule_mode === 'manual' && (
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={form.manual_scheduled_at}
                      onChange={e => setForm(f => ({ ...f, manual_scheduled_at: e.target.value }))}
                    />
                  )}
                </div>

                <div className="glass-card" style={{ padding: 'var(--space-5)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: 10 }}>Post Preview</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Title</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{form.title || 'Untitled video'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Description</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45, maxHeight: 70, overflow: 'hidden' }}>
                        {form.description || 'No description yet.'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(form.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 8).map(tag => (
                        <span key={tag} className="badge badge-info">#{tag}</span>
                      ))}
                      {!(form.tags || '').trim() && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No tags added.</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge badge-info">{form.privacy}</span>
                      <span className="badge badge-info">{CATEGORIES[form.category_id] || 'Category'}</span>
                      <span className="badge badge-success">{form.schedule_mode === 'post_now' ? 'Post now' : form.schedule_mode === 'manual' ? 'Manual schedule' : 'Auto schedule'}</span>
                    </div>
                    {form.schedule_mode === 'manual' && form.manual_scheduled_at && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Scheduled for {new Date(form.manual_scheduled_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                {uploading && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                      <span>Uploading to server…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary" disabled={uploading}>
                    {uploading ? <><span className="spinner" /> Uploading…</> : <><Upload size={16} /> Add to Queue</>}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setSelectedFile(null); setSingleDetection(null); setShowForm(false) }}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Content Repository Tabs */}
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="tabs" style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {[
              { key: 'queue', label: 'Queued' },
              { key: 'scheduled', label: 'Scheduled' },
              { key: 'published', label: 'Uploaded' },
              { key: 'failed', label: 'Failed' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`tab-btn${activeTab === key ? ' active' : ''}`}
                onClick={() => setActiveTab(key)}
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {label}
                {tabCounts[key] > 0 && (
                  <span style={{
                    background: activeTab === key ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '10px', 
                    fontWeight: '800', 
                    padding: '2px 8px', 
                    borderRadius: '6px'
                  }}>{tabCounts[key]}</span>
                )}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={loadVideos}>
              <RefreshCw size={14} />
            </button>
          </div>

          <div style={{ padding: 'var(--space-6)' }}>
            {tabVideos.length > 0 ? (
              <div className="video-list">
                {tabVideos.map(v => <VideoItem key={v.id} video={v} onRefresh={loadVideos} />)}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '60px 0' }}>
                <Film size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Nothing here</h3>
                <p style={{ color: 'var(--text-tertiary)' }}>{activeTab === 'queue' ? 'Upload a video to get started.' : `No ${activeTab} videos yet.`}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

import axios from 'axios'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export const MEDIA_BASE_URL = API_BASE_URL.replace(/\/api$/, '')

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes for massive AI scientific audits
})

api.interceptors.request.use((config) => {
  const storageKey = 'ytscheduler-supabase-auth';
  const sessionData = localStorage.getItem(storageKey);
  if (sessionData) {
    try {
      const { access_token } = JSON.parse(sessionData);
      if (access_token) {
        config.headers.Authorization = `Bearer ${access_token}`;
      } else {
        console.warn('[API] No access_token found in sessionData');
      }
    } catch (e) {
      console.error('[API] Error parsing Supabase session:', e);
    }
  } else {
    // console.log('[API] No sessionData found in localStorage');
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const payload = response?.data
    if (payload && payload.success === true && Object.prototype.hasOwnProperty.call(payload, 'data')) {
      response.data = payload.data
    }
    return response
  },
  (error) => {
    const payload = error?.response?.data
    if (payload?.error?.message) {
      error.message = payload.error.message
    }
    return Promise.reject(error)
  },
)

// Auth
export const getAuthUrl   = () => api.get('/auth/url')
export const getAuthStatus = () => api.get('/auth/status')
export const disconnect    = () => api.delete('/auth/disconnect')
export const getChannels   = () => api.get('/auth/channels')
export const switchChannel = (channel_id) => api.post('/auth/switch', { channel_id })

// Channel and Playlists
export const getChannelInfo    = () => api.get('/channel/info')
export const getChannelUploads = () => api.get('/channel/uploads')
export const getChannelDailyAnalytics = () => api.get('/channel/analytics/daily')
export const getPlaylists      = () => api.get('/youtube/playlists')
export const createPlaylist    = (data) => api.post('/youtube/playlists', data)

// Videos
export const listVideos       = (status) => api.get('/videos', { params: status ? { status } : {} })
export const uploadVideoFile  = (formData, onProgress) =>
  api.post('/videos/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
    timeout: 0,
  })
export const uploadNow        = (id) => api.post(`/videos/${id}/upload-now`)
export const updateVideo      = (id, data) => api.put(`/videos/${id}`, data)
export const deleteVideo      = (id) => api.delete(`/videos/${id}`)
export const assignNextSlot   = (id) => api.post(`/videos/${id}/assign-next-slot`)
export const autoFillQueue    = () => api.post('/videos/auto-fill-queue')

// YouTube-direct update (for channel-only videos that have no managed DB record)
export const updateYouTubeVideo = (youtubeId, data) => api.put(`/videos/youtube/${youtubeId}`, data)
export const uploadYouTubeThumbnail = (youtubeId, formData) =>
  api.post(`/videos/youtube/${youtubeId}/thumbnail`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const deleteYouTubeVideo = (youtubeId) => api.delete(`/videos/youtube/${youtubeId}`)

// Schedule
export const getSlots         = () => api.get('/schedule/slots')
export const generateSchedule = (data) => api.post('/schedule/generate', data)
export const addSlot          = (data) => api.post('/schedule/slots', data)
export const deleteSlot       = (id) => api.delete(`/schedule/slots/${id}`)
export const getCalendar      = (year, month) => api.get('/schedule/calendar', { params: { year, month } })

// AI
export const generateCaption  = (data) => api.post('/ai/caption', data)

// Settings
export const getSettings      = () => api.get('/settings')
export const updateSettings   = (data) => api.put('/settings', data)

// Bulk Upload
export const bulkUploadVideos = (formData, onProgress) =>
  api.post('/videos/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
    timeout: 0,
  })

// Drafts
export const listDrafts = () => api.get('/videos/drafts')
export const publishDraft = (id) => api.post(`/videos/${id}/publish`)

// Retry/Reschedule
export const retryFailed = (id) => api.post(`/videos/${id}/retry`)
export const rescheduleVideo = (id, data) => api.post(`/videos/${id}/reschedule`, data)

// Thumbnail
export const uploadThumbnail = (id, formData) =>
  api.post(`/videos/${id}/thumbnail`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// Time Zone
export const updateTimeZone = (data) => api.put('/settings/timezone', data)

// Notification
export const updateNotificationStatus = (id, data) => api.post(`/videos/${id}/notify`, data)

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats')

// Reporting
export const generateReportingPPT = (startDate, endDate) => 
  api.get('/reporting/generate-ppt', { 
    params: { startDate, endDate }, 
    responseType: 'blob' 
  })

export default api

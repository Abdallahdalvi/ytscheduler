import { nodeApi } from '../../services/api/client'
import { unwrapApiResponse } from '../../services/api/response'

export const postsService = {
  list: async () => {
    const res = await nodeApi.get('/posts')
    return unwrapApiResponse(res)
  },

  getById: async (id) => {
    const res = await nodeApi.get(`/posts/${id}`)
    return unwrapApiResponse(res)
  },

  create: async (payload) => {
    const res = await nodeApi.post('/posts', payload)
    return unwrapApiResponse(res)
  },

  update: async (id, payload) => {
    const res = await nodeApi.patch(`/posts/${id}`, payload)
    return unwrapApiResponse(res)
  },

  updateStatus: async (id, payload) => {
    const res = await nodeApi.post(`/posts/${id}/status`, payload)
    return unwrapApiResponse(res)
  },

  remove: async (id) => {
    await nodeApi.delete(`/posts/${id}`)
  },

  duplicate: async (id) => {
    const res = await nodeApi.post(`/posts/${id}/duplicate`)
    return unwrapApiResponse(res)
  },

  bulkDelete: async (ids) => {
    const res = await nodeApi.post('/posts/bulk/delete', { ids })
    return unwrapApiResponse(res)
  },

  bulkReschedule: async (ids, scheduledAtIso) => {
    const res = await nodeApi.post('/posts/bulk/reschedule', {
      ids,
      scheduled_at: scheduledAtIso,
    })
    return unwrapApiResponse(res)
  },
}

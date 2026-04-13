import { nodeApi } from '../../services/api/client'
import { unwrapApiResponse } from '../../services/api/response'

export const mediaService = {
  list: async ({ type, q } = {}) => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (q) params.set('q', q)
    const suffix = params.toString() ? `?${params.toString()}` : ''
    const res = await nodeApi.get(`/media${suffix}`)
    return unwrapApiResponse(res) || []
  },

  upload: async (payload) => {
    const res = await nodeApi.post('/media/upload', payload)
    return unwrapApiResponse(res)
  },

  remove: async (id) => {
    await nodeApi.delete(`/media/${id}`)
  },
}

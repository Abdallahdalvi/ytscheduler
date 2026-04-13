import { nodeApi } from '../../services/api/client'
import { unwrapApiResponse } from '../../services/api/response'

export const templatesService = {
  list: async () => {
    const res = await nodeApi.get('/templates')
    return unwrapApiResponse(res) || []
  },

  create: async (payload) => {
    const res = await nodeApi.post('/templates', payload)
    return unwrapApiResponse(res)
  },

  update: async (id, payload) => {
    const res = await nodeApi.patch(`/templates/${id}`, payload)
    return unwrapApiResponse(res)
  },

  remove: async (id) => {
    await nodeApi.delete(`/templates/${id}`)
  },
}

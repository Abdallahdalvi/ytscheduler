import { nodeApi } from '../../services/api/client'
import { unwrapApiResponse } from '../../services/api/response'

export const activityService = {
  list: async (limit = 50) => {
    const res = await nodeApi.get(`/activity-logs?limit=${limit}`)
    return unwrapApiResponse(res) || []
  },

  create: async (payload) => {
    const res = await nodeApi.post('/activity-logs', payload)
    return unwrapApiResponse(res)
  },
}

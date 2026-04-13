import { nodeApi } from '../../services/api/client'
import { unwrapApiResponse } from '../../services/api/response'

export const schedulerService = {
  listCalendar: async () => {
    const res = await nodeApi.get('/scheduler/calendar')
    return unwrapApiResponse(res) || []
  },

  listRules: async () => {
    const res = await nodeApi.get('/scheduler/rules')
    return unwrapApiResponse(res) || []
  },

  createRule: async (payload) => {
    const res = await nodeApi.post('/scheduler/rules', payload)
    return unwrapApiResponse(res)
  },

  deleteRule: async (id) => {
    await nodeApi.delete(`/scheduler/rules/${id}`)
  },

  autoFillQueue: async (count = 10) => {
    const res = await nodeApi.post('/scheduler/queue/autofill', { count })
    return unwrapApiResponse(res)
  },
}

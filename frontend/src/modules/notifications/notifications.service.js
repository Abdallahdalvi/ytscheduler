import { nodeApi } from '../../services/api/client'
import { unwrapApiResponse } from '../../services/api/response'

export const notificationsService = {
  list: async () => {
    const res = await nodeApi.get('/notifications')
    return unwrapApiResponse(res) || []
  },

  create: async (payload) => {
    const res = await nodeApi.post('/notifications', payload)
    return unwrapApiResponse(res)
  },

  markRead: async (id) => {
    const res = await nodeApi.patch(`/notifications/${id}/read`)
    return unwrapApiResponse(res)
  },

  markAllRead: async () => {
    const res = await nodeApi.patch('/notifications/read-all')
    return unwrapApiResponse(res)
  },

  getUnreadCount: async () => {
    const res = await nodeApi.get('/notifications')
    const items = unwrapApiResponse(res) || []
    return items.filter((n) => n.status !== 'read').length
  },
}

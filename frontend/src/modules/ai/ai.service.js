import { nodeApi } from '../../services/api/client'

export const aiService = {
  generateTitle: async (payload) => {
    const res = await nodeApi.post('/ai/title', payload)
    return res.data.data
  },

  generateDescription: async (payload) => {
    const res = await nodeApi.post('/ai/description', payload)
    return res.data.data
  },

  generateTags: async (payload) => {
    const res = await nodeApi.post('/ai/tags', payload)
    return res.data.data
  },

  generateThumbnailText: async (payload) => {
    const res = await nodeApi.post('/ai/thumbnail-text', payload)
    return res.data.data
  },

  seoScore: async (payload) => {
    const res = await nodeApi.post('/ai/seo-score', payload)
    return res.data.data
  },
}

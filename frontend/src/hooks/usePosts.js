import { useCallback, useEffect, useState } from 'react'
import { postsService } from '../modules/posts/posts.service'

export function usePosts() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await postsService.list()
      setPosts(data || [])
    } catch (err) {
      setError(err?.message || 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { posts, loading, error, refresh, setPosts }
}

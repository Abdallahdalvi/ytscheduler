export function unwrapApiResponse(response) {
  if (!response?.data) {
    throw new Error('Empty response from server')
  }

  const payload = response.data
  if (payload.success === false) {
    throw new Error(payload.error?.message || 'Request failed')
  }

  if (payload.success === true && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data
  }

  return payload
}

export function toApiError(error) {
  const fromApi = error?.response?.data?.error?.message
  const fromDetail = error?.response?.data?.detail
  const message = fromApi || fromDetail || error?.message || 'Unexpected API error'
  return new Error(message)
}
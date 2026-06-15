export const getApiErrorMessage = (error, fallback = 'Something went wrong') => (
  error?.response?.data?.detail
  || error?.response?.data?.message
  || error?.message
  || fallback
)

export default getApiErrorMessage

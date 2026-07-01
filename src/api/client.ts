import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const token = localStorage.getItem('access_token')
      const url: string = err.config?.url ?? ''
      // If there's no token at all, or the 401 came from an auth endpoint
      // (login/refresh), the session is truly invalid — force logout.
      // A 401 on a data endpoint while a token exists means the backend rejected
      // the role (should be 403) — don't wipe the session in that case.
      if (!token || url.includes('/auth/')) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api

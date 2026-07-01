import axios from 'axios'

// Client for legacy data endpoints: /api/hotspots, /api/incidents, /api/boundaries
// These are unauthenticated endpoints served by main.py (no JWT required).
const dataApi = axios.create({
  baseURL: '/api',
  headers: { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
})

export default dataApi

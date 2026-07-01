import { create } from 'zustand'

export type WsEventType = 'hotspot_new' | 'fire_detection_new' | 'incident_new'

export interface WsAlert {
  id: string
  type: WsEventType
  data: Record<string, unknown>
  receivedAt: Date
}

interface AlertState {
  alerts: WsAlert[]
  toasts: WsAlert[]
  wsConnected: boolean
  addEvent: (type: WsEventType, data: Record<string, unknown>) => void
  dismissToast: (id: string) => void
  setWsConnected: (v: boolean) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  toasts: [],
  wsConnected: false,

  addEvent: (type, data) => {
    const alert: WsAlert = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      data,
      receivedAt: new Date(),
    }
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 50),
      toasts: [alert, ...state.toasts].slice(0, 5),
    }))
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setWsConnected: (v) => set({ wsConnected: v }),
}))

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'

interface Station {
  id: number
  station_code: string
  name: string
  province: string | null
  latitude: number
  longitude: number
  rtsp_url: string | null
  ptz_url: string | null
  image_width: number
  image_height: number
  absolute_zoom: number
  field_of_view: number | null
  tilt_angle: number | null
  cam_height_agl: number | null
  is_active: boolean
}

interface Detection {
  id: number
  station_code: string
  detected_at: string
  confidence: number
  fire_longitude: number | null
  fire_latitude: number | null
  distance_m: number | null
  commune: string | null
  district: string | null
  snapshot_path: string | null
  status: string
}

interface Props {
  station: Station
  onClose: () => void
}

const STATUS_DOT: Record<string, string> = {
  pending:   'bg-amber-400',
  confirmed: 'bg-emerald-400',
  rejected:  'bg-slate-400',
}

export default function CameraStreamModal({ station, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  const token = localStorage.getItem('access_token') ?? ''

  const [streamState, setStreamState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [detections, setDetections]   = useState<Detection[]>([])
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [ptzBusy, setPtzBusy]         = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const streamSrc   = `/api/v1/cameras/stations/${station.id}/mjpeg?token=${encodeURIComponent(token)}`
  const snapshotSrc = `/api/v1/cameras/stations/${station.id}/snapshot?token=${encodeURIComponent(token)}`

  // Load recent detections for this station
  useEffect(() => {
    api.get('/cameras/detections', { params: { station_code: station.station_code, limit: 6 } })
      .then(r => setDetections(r.data))
      .catch(() => {})
  }, [station.station_code])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const refreshStream = useCallback(() => {
    setStreamState('loading')
    if (imgRef.current) {
      imgRef.current.src = streamSrc + '&_t=' + Date.now()
    }
  }, [streamSrc])

  async function sendPtz(command: string) {
    if (ptzBusy) return
    setPtzBusy(true)
    try {
      await api.post(`/cameras/stations/${station.id}/ptz`, { command, speed: 4 })
    } catch {
      // PTZ failure is non-critical — silently ignore
    } finally {
      setPtzBusy(false)
    }
  }

  function openDetectionSnapshot(det: Detection) {
    if (!det.snapshot_path) return
    const url = `/api/v1/cameras/detections/${det.id}/snapshot?token=${encodeURIComponent(token)}`
    setLightboxUrl(url)
  }

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-[#1a2e4a] rounded-2xl w-full max-w-5xl overflow-hidden flex flex-col shadow-2xl"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/10 flex-shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${station.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="text-[10px] font-mono text-[#94a3b8] uppercase tracking-wider">{station.station_code}</span>
          <h2 className="text-white font-semibold truncate">{station.name}</h2>
          {station.province && (
            <span className="text-[#94a3b8] text-sm hidden sm:inline">— {station.province}</span>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white transition-colors flex-shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Stream panel */}
          <div className="flex-1 flex flex-col bg-black min-w-0 relative">
            {!station.rtsp_url ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#64748b] gap-3 p-8">
                <span className="material-symbols-outlined text-6xl">videocam_off</span>
                <p className="text-sm text-center">{t('cameras.noStream')}</p>
              </div>
            ) : streamState === 'error' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#64748b] gap-4 p-8">
                <span className="material-symbols-outlined text-6xl text-red-500/70">signal_disconnected</span>
                <p className="text-sm">{t('cameras.streamError')}</p>
                <button
                  onClick={refreshStream}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  {t('common.refresh')}
                </button>
              </div>
            ) : (
              <>
                {streamState === 'loading' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-[#94a3b8] gap-3 z-10 bg-black">
                    <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
                    <p className="text-sm">{t('cameras.streamLoading')}</p>
                  </div>
                )}
                <img
                  ref={imgRef}
                  src={streamSrc}
                  alt={station.name}
                  onLoad={() => setStreamState('ok')}
                  onError={() => setStreamState('error')}
                  className={`w-full h-full object-contain transition-opacity duration-500 ${streamState === 'ok' ? 'opacity-100' : 'opacity-0'}`}
                  style={{ minHeight: '300px' }}
                />
              </>
            )}

            {/* Stream toolbar */}
            {station.rtsp_url && (
              <div className="flex items-center gap-3 px-4 py-2 bg-black/50 border-t border-white/5 flex-shrink-0">
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  LIVE
                </span>
                <span className="flex-1" />
                <button
                  onClick={refreshStream}
                  className="p-1.5 text-[#94a3b8] hover:text-white transition-colors"
                  title={t('common.refresh')}
                >
                  <span className="material-symbols-outlined text-lg">refresh</span>
                </button>
                <a
                  href={snapshotSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#94a3b8] hover:text-white transition-colors border border-white/10 rounded-lg"
                >
                  <span className="material-symbols-outlined text-base">photo_camera</span>
                  {t('cameras.snapshotBtn')}
                </a>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="w-56 flex-shrink-0 border-l border-white/10 overflow-y-auto flex flex-col">
            {/* Station info */}
            <div className="p-4 border-b border-white/10">
              <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider mb-3">{t('cameras.stationInfo')}</p>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#94a3b8] flex-shrink-0">Lat / Lon</dt>
                  <dd className="text-white font-mono text-right">
                    {station.latitude.toFixed(4)}°N<br />{station.longitude.toFixed(4)}°E
                  </dd>
                </div>
                {station.field_of_view != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#94a3b8]">{t('cameras.fieldFovShort')}</dt>
                    <dd className="text-white">{station.field_of_view}°</dd>
                  </div>
                )}
                {station.cam_height_agl != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#94a3b8]">{t('cameras.fieldHeightShort')}</dt>
                    <dd className="text-white">{station.cam_height_agl} m</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-[#94a3b8]">{t('cameras.fieldZoomShort')}</dt>
                  <dd className="text-white">{station.absolute_zoom}×</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#94a3b8]">{t('common.status')}</dt>
                  <dd className={station.is_active ? 'text-emerald-400' : 'text-slate-400'}>
                    {station.is_active ? t('cameras.statusActive') : t('cameras.statusInactive')}
                  </dd>
                </div>
              </dl>
            </div>

            {/* PTZ Controls */}
            <div className="p-4 border-b border-white/10">
              <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider mb-3">{t('cameras.ptzTitle')}</p>
              {station.ptz_url ? (
                <div className="flex flex-col items-center gap-1">
                  <PtzBtn icon="keyboard_arrow_up" title="Up" disabled={ptzBusy} onClick={() => sendPtz('up')} />
                  <div className="flex gap-1">
                    <PtzBtn icon="keyboard_arrow_left" title="Left" disabled={ptzBusy} onClick={() => sendPtz('left')} />
                    <PtzBtn icon="home" title={t('cameras.ptzHome')} disabled={ptzBusy} onClick={() => sendPtz('home')} />
                    <PtzBtn icon="keyboard_arrow_right" title="Right" disabled={ptzBusy} onClick={() => sendPtz('right')} />
                  </div>
                  <PtzBtn icon="keyboard_arrow_down" title="Down" disabled={ptzBusy} onClick={() => sendPtz('down')} />
                  <div className="flex gap-1 mt-1 w-full">
                    <button
                      onClick={() => sendPtz('zoom_in')} disabled={ptzBusy}
                      className="flex-1 h-8 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-lg text-xs text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">zoom_in</span>
                      {t('cameras.ptzZoomIn')}
                    </button>
                    <button
                      onClick={() => sendPtz('zoom_out')} disabled={ptzBusy}
                      className="flex-1 h-8 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-lg text-xs text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">zoom_out</span>
                      {t('cameras.ptzZoomOut')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#64748b]">{t('cameras.ptzNone')}</p>
              )}
            </div>

            {/* Recent detections */}
            <div className="p-4 flex-1">
              <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider mb-3">{t('cameras.recentDetections')}</p>
              {detections.length === 0 ? (
                <p className="text-xs text-[#64748b]">{t('cameras.noRecentDet')}</p>
              ) : (
                <div className="space-y-1.5">
                  {detections.map(d => (
                    <button
                      key={d.id}
                      onClick={() => openDetectionSnapshot(d)}
                      disabled={!d.snapshot_path}
                      className={`w-full text-left p-2.5 rounded-lg bg-white/5 transition-colors ${d.snapshot_path ? 'hover:bg-white/10 cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[d.status] ?? 'bg-slate-400'}`} />
                        <span className={`text-xs font-semibold ${d.confidence >= 0.9 ? 'text-red-400' : d.confidence >= 0.7 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {(d.confidence * 100).toFixed(0)}%
                        </span>
                        <span className="text-[10px] text-[#64748b] ml-auto">
                          {new Date(d.detected_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {(d.commune || d.district) && (
                        <p className="text-[10px] text-[#94a3b8] truncate pl-3.5">
                          {[d.commune, d.district].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {d.snapshot_path && (
                        <span className="flex items-center gap-0.5 text-[10px] text-[#1565c0] mt-1 pl-3.5">
                          <span className="material-symbols-outlined text-xs">photo_camera</span>
                          {t('cameras.detSnapshot')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-60 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="snapshot"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  )
}

function PtzBtn({ icon, title, disabled, onClick }: {
  icon: string; title: string; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-lg text-white transition-colors"
    >
      <span className="material-symbols-outlined text-xl">{icon}</span>
    </button>
  )
}

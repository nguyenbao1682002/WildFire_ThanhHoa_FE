import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as turf from '@turf/turf'
import { kml as kmlToGeoJSON } from '@tmcw/togeojson'
// @ts-expect-error — shpjs có types nhưng không khai báo default export
import shp from 'shpjs'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Bookmark { id: string; name: string; center: [number, number]; zoom: number }

type DrawMode = 'point' | 'line' | 'polygon' | null

interface DrawnFeature {
  id: string
  mode: 'point' | 'line' | 'polygon'
  coords: [number, number][]
  label: string
}

interface ImportedLayer {
  id: string
  name: string
  color: string
  featureCount: number
}

// ── Basemaps ──────────────────────────────────────────────────────────────────
const BASEMAPS = [
  { id: 'dark',    style: 'https://tiles.openfreemap.org/styles/dark' },
  { id: 'light',   style: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'voyager', style: 'https://tiles.openfreemap.org/styles/liberty' },
] as const

// ── Layer definitions ─────────────────────────────────────────────────────────
const LAYER_DEFS = [
  { id: 'province-fill',   color: '#3b82f6', icon: 'map' },
  { id: 'province-line',   color: '#1d4ed8', icon: 'straighten' },
  { id: 'districts-line',  color: '#60a5fa', icon: 'grid_on' },
  { id: 'hotspots-heat',   color: '#ef4444', icon: 'whatshot' },
  { id: 'hotspots-points', color: '#fbbf24', icon: 'crisis_alert' },
  { id: 'incidents',       color: '#60a5fa', icon: 'local_fire_department' },
] as const

type LayerId = typeof LAYER_DEFS[number]['id']
type Visibility = Record<LayerId, boolean>
type ActiveTool = 'goto' | 'measure' | 'bookmark' | 'heatmap' | 'draw' | 'import' | null

const DEFAULT_VIS: Visibility = {
  'province-fill': true, 'province-line': true, 'districts-line': true,
  'hotspots-heat': true, 'hotspots-points': true, 'incidents': true,
}

const IMPORT_COLORS = ['#7c3aed', '#0284c7', '#059669', '#dc2626', '#d97706', '#db2777', '#0891b2', '#65a30d']

// ── GIS layer helpers (module 8) ──────────────────────────────────────────────
function addGISLayerToMap(map: maplibregl.Map, layer: ImportedLayer, geojson: GeoJSON.FeatureCollection) {
  const src = `import-${layer.id}`
  if (map.getSource(src)) return
  map.addSource(src, { type: 'geojson', data: geojson })
  map.addLayer({ id: `${src}-fill`, type: 'fill', source: src,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': layer.color, 'fill-opacity': 0.18 } })
  map.addLayer({ id: `${src}-line`, type: 'line', source: src,
    paint: { 'line-color': layer.color, 'line-width': 2 } })
  map.addLayer({ id: `${src}-point`, type: 'circle', source: src,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 6, 'circle-color': layer.color,
      'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
}

function removeGISLayerFromMap(map: maplibregl.Map, layerId: string) {
  const src = `import-${layerId}`
  ;[`${src}-fill`, `${src}-line`, `${src}-point`].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id)
  })
  if (map.getSource(src)) map.removeSource(src)
}

async function parseGISFile(file: File, tFn: (key: string, opts?: Record<string, string>) => string): Promise<GeoJSON.FeatureCollection> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'geojson' || ext === 'json') {
    const text = await file.text()
    return JSON.parse(text) as GeoJSON.FeatureCollection
  }
  if (ext === 'kml') {
    const text = await file.text()
    const dom = new DOMParser().parseFromString(text, 'text/xml')
    return kmlToGeoJSON(dom) as GeoJSON.FeatureCollection
  }
  if (ext === 'zip') {
    const buf = await file.arrayBuffer()
    const result = await shp(buf)
    if (Array.isArray(result)) return result[0] as GeoJSON.FeatureCollection
    return result as GeoJSON.FeatureCollection
  }
  throw new Error(tFn('map.import.unsupported', { ext: ext ?? '?' }))
}

// ── Geodesic distance (haversine) ─────────────────────────────────────────────
function haversine([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const R = 6371e3
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function totalDist(pts: [number, number][]): number {
  let d = 0
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i])
  return d
}

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

function polygonArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0
  const closed = [...coords, coords[0]]
  const poly = turf.polygon([closed])
  return turf.area(poly)
}

function fmtArea(sqm: number) {
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(2)} km²`
  if (sqm >= 10_000)    return `${(sqm / 10_000).toFixed(2)} ha`
  return `${Math.round(sqm)} m²`
}

// ── Popup helpers ─────────────────────────────────────────────────────────────
function hotspotHtml(p: Record<string, unknown>, lngLat: [number, number], tFn: (k: string) => string, locale: string) {
  const c = Number(p['confidence_score'])
  const color = c > 90 ? '#ef4444' : c > 70 ? '#fbbf24' : '#34d399'
  const badge = c > 90 ? tFn('map.popup.extreme') : c > 70 ? tFn('map.popup.high') : c > 50 ? tFn('map.popup.medium') : tFn('map.popup.low')
  const detectedAt = p['detected_at'] ? new Date(String(p['detected_at'])).toLocaleString(locale) : '—'
  return `<div class="wf-popup">
    <div class="wf-title" style="color:#fbbf24">🔥 ${tFn('map.popup.hotspot')} #${p['id']}</div>
    <div class="wf-row"><span>${tFn('map.popup.device')}</span><b>${p['device_id'] ?? '—'}</b></div>
    <div class="wf-row"><span>${tFn('map.popup.confidence')}</span><b style="color:${color}">${c}% <span style="font-size:10px;opacity:0.8">(${badge})</span></b></div>
    <div class="wf-row"><span>${tFn('map.popup.detectedAt')}</span><b>${detectedAt}</b></div>
    <div class="wf-row"><span>${tFn('map.popup.coord')}</span><b style="font-size:10px;font-family:monospace">${lngLat[1].toFixed(5)}, ${lngLat[0].toFixed(5)}</b></div>
    <hr class="wf-divider"/>
    <a class="wf-link" href="/hotspots">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
      ${tFn('map.popup.viewHotspots')}
    </a>
  </div>`
}

function incidentHtml(p: Record<string, unknown>, tFn: (k: string) => string) {
  const SL: Record<string, string> = {
    uncontrolled: tFn('map.popup.statusUncontrolled'),
    containing:   tFn('map.popup.statusContaining'),
    controlled:   tFn('map.popup.statusControlled'),
  }
  const SC: Record<string, string> = { uncontrolled: '#ef4444', containing: '#fbbf24', controlled: '#34d399' }
  const PL: Record<string, string> = {
    high:     tFn('map.popup.priorityHigh'),
    medium:   tFn('map.popup.priorityMedium'),
    low:      tFn('map.popup.priorityLow'),
    critical: tFn('map.popup.priorityCritical'),
  }
  const s = String(p['status'])
  const pri = String(p['priority'])
  return `<div class="wf-popup">
    <div class="wf-title" style="color:#60a5fa">${p['incident_code'] ?? '—'}</div>
    <div class="wf-sub">${p['title'] ?? ''}</div>
    <div class="wf-row"><span>${tFn('map.popup.status')}</span><b style="color:${SC[s] ?? '#64748b'}">${SL[s] ?? s}</b></div>
    <div class="wf-row"><span>${tFn('map.popup.burnArea')}</span><b>${p['burn_area_acres'] ?? 0} ha</b></div>
    <div class="wf-row"><span>${tFn('map.popup.priority')}</span><b>${PL[pri] ?? pri}</b></div>
    ${p['assigned_to'] ? `<div class="wf-row"><span>${tFn('map.popup.assignedTo')}</span><b>${p['assigned_to']}</b></div>` : ''}
    <hr class="wf-divider"/>
    <a class="wf-link" href="/incidents">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
      ${tFn('map.popup.viewIncidents')}
    </a>
  </div>`
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

// GeoJSON từ API — MapLibre fetch trực tiếp qua URL, không cần axios
const HOTSPOTS_URL   = '/api/hotspots/geojson'
const INCIDENTS_URL  = '/api/incidents/geojson'

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  const tRef      = useRef(t)
  const localeRef = useRef(locale)
  useEffect(() => { tRef.current = t }, [t])
  useEffect(() => { localeRef.current = locale }, [locale])

  const basemapLabels: Record<string, string> = {
    dark: t('map.dark'), light: t('map.light'), voyager: t('map.geographic'),
  }
  const layerLabels: Record<string, string> = {
    'province-fill':   t('map.layer.provinceFill'),
    'province-line':   t('map.layer.provinceLine'),
    'districts-line':  t('map.layer.districtsLine'),
    'hotspots-heat':   t('map.layer.hotspotsHeat'),
    'hotspots-points': t('map.layer.hotspotsPoints'),
    'incidents':       t('map.layer.incidents'),
  }

  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<maplibregl.Map | null>(null)
  const popupRef      = useRef<maplibregl.Popup | null>(null)
  const visRef        = useRef<Visibility>(DEFAULT_VIS)
  const activeToolRef = useRef<ActiveTool>(null)
  const measurePtsRef = useRef<[number, number][]>([])
  const mMarkersRef   = useRef<maplibregl.Marker[]>([])
  const gotoMarkerRef = useRef<maplibregl.Marker | null>(null)

  const [basemap,       setBasemap]       = useState<string>('dark')
  const [visible,       setVisible]       = useState<Visibility>(DEFAULT_VIS)
  const [mapReady,      setMapReady]      = useState(false)
  const [activeTool,    setActiveTool]    = useState<ActiveTool>(null)
  const [measurePts,    setMeasurePts]    = useState<[number, number][]>([])
  const [gotoLat,       setGotoLat]       = useState('19.8000')
  const [gotoLng,       setGotoLng]       = useState('105.7800')
  const [gotoZoom,      setGotoZoom]      = useState('10')
  const [bookmarks,     setBookmarks]     = useState<Bookmark[]>(() => {
    try { return JSON.parse(localStorage.getItem('wf-bookmarks') ?? '[]') } catch { return [] }
  })
  const [bmNameInput,   setBmNameInput]   = useState('')

  // Heatmap controls
  const [hmRadius,    setHmRadius]    = useState(35)
  const [hmIntensity, setHmIntensity] = useState(15)   // stored as ×10 for integer slider (1.5 → 15)
  const [hmMinConf,   setHmMinConf]   = useState(0)

  // Draw tool
  const drawModeRef         = useRef<DrawMode>(null)
  const activeDrawRef       = useRef<[number, number][]>([])
  const drawnFeaturesRef    = useRef<DrawnFeature[]>([])
  const [drawMode,          setDrawMode]          = useState<DrawMode>(null)
  const [activeDrawCoords,  setActiveDrawCoords]  = useState<[number, number][]>([])
  const [drawnFeatures,     setDrawnFeatures]     = useState<DrawnFeature[]>([])

  // Import GIS layers (module 8)
  const importedGeojsonRef = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map())
  const [importedLayers,   setImportedLayers]   = useState<ImportedLayer[]>([])
  const [importError,      setImportError]      = useState<string | null>(null)
  const [importing,        setImporting]        = useState(false)

  // Clustering (module 24)
  const [clusterEnabled, setClusterEnabled] = useState(true)
  const clusterEnabledRef = useRef(true)

  // Sync refs to current state
  useEffect(() => { visRef.current = visible }, [visible])
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { drawModeRef.current = drawMode }, [drawMode])
  useEffect(() => { clusterEnabledRef.current = clusterEnabled }, [clusterEnabled])

  // Cursor style when measure or draw tool active
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    if (!canvas) return
    if (activeTool === 'measure' || (activeTool === 'draw' && drawMode)) {
      canvas.style.cursor = 'crosshair'
    } else {
      canvas.style.cursor = ''
    }
  }, [activeTool, drawMode])

  // Disable double-click zoom while drawing line/polygon
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (activeTool === 'draw' && (drawMode === 'line' || drawMode === 'polygon')) {
      map.doubleClickZoom.disable()
    } else {
      map.doubleClickZoom.enable()
    }
  }, [activeTool, drawMode])

  // Sync heatmap paint properties when controls change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !map.getLayer('hotspots-heat')) return
    // Override the zoom-interpolated radius with a flat value from the slider
    map.setPaintProperty('hotspots-heat', 'heatmap-radius', hmRadius)
    map.setPaintProperty('hotspots-heat', 'heatmap-intensity', hmIntensity / 10)
  }, [hmRadius, hmIntensity, mapReady])

  // Filter heatmap by minimum confidence score
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !map.getLayer('hotspots-heat')) return
    if (hmMinConf > 0) {
      map.setFilter('hotspots-heat', ['>=', ['get', 'confidence_score'], hmMinConf])
      map.setFilter('hotspots-points', ['>=', ['get', 'confidence_score'], hmMinConf])
    } else {
      map.setFilter('hotspots-heat', null)
      map.setFilter('hotspots-points', null)
    }
  }, [hmMinConf, mapReady])

  // ── Clear measure ────────────────────────────────────────────────────────────
  const clearMeasure = useCallback(() => {
    mMarkersRef.current.forEach((m) => m.remove())
    mMarkersRef.current = []
    measurePtsRef.current = []
    setMeasurePts([])
    const map = mapRef.current
    if (map?.getSource('measure-line')) {
      (map.getSource('measure-line') as maplibregl.GeoJSONSource).setData(EMPTY_FC)
    }
  }, [])

  // ── Toggle tool ──────────────────────────────────────────────────────────────
  function toggleTool(tool: ActiveTool) {
    if (activeTool === tool) {
      setActiveTool(null)
      if (tool === 'measure') clearMeasure()
      if (tool === 'goto') { gotoMarkerRef.current?.remove(); gotoMarkerRef.current = null }
    } else {
      if (activeTool === 'measure') clearMeasure()
      if (activeTool === 'goto') { gotoMarkerRef.current?.remove(); gotoMarkerRef.current = null }
      setActiveTool(tool)
    }
  }

  // ── Add measure layers (called after style loads) ─────────────────────────────
  const addMeasureLayers = useCallback((map: maplibregl.Map) => {
    if (!map.getSource('measure-line'))
      map.addSource('measure-line', { type: 'geojson', data: EMPTY_FC })
    if (!map.getLayer('measure-line-layer'))
      map.addLayer({ id: 'measure-line-layer', type: 'line', source: 'measure-line',
        paint: { 'line-color': '#f59e0b', 'line-width': 2.5, 'line-dasharray': [2, 1.5] },
      })
  }, [])

  // ── Add draw layers ────────────────────────────────────────────────────────────
  const addDrawLayers = useCallback((map: maplibregl.Map) => {
    const EFC = EMPTY_FC
    // Completed features
    if (!map.getSource('draw-done')) map.addSource('draw-done', { type: 'geojson', data: EFC })
    if (!map.getLayer('draw-done-poly-fill'))
      map.addLayer({ id: 'draw-done-poly-fill', type: 'fill', source: 'draw-done',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.15 } })
    if (!map.getLayer('draw-done-poly-line'))
      map.addLayer({ id: 'draw-done-poly-line', type: 'line', source: 'draw-done',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'line-color': '#2563eb', 'line-width': 2 } })
    if (!map.getLayer('draw-done-line'))
      map.addLayer({ id: 'draw-done-line', type: 'line', source: 'draw-done',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#7c3aed', 'line-width': 2.5 } })
    if (!map.getLayer('draw-done-point'))
      map.addLayer({ id: 'draw-done-point', type: 'circle', source: 'draw-done',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 7, 'circle-color': '#16a34a', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
    // Active feature preview (during drawing)
    if (!map.getSource('draw-active')) map.addSource('draw-active', { type: 'geojson', data: EFC })
    if (!map.getLayer('draw-active-poly-fill'))
      map.addLayer({ id: 'draw-active-poly-fill', type: 'fill', source: 'draw-active',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1 } })
    if (!map.getLayer('draw-active-line'))
      map.addLayer({ id: 'draw-active-line', type: 'line', source: 'draw-active',
        paint: { 'line-color': '#6366f1', 'line-width': 2, 'line-dasharray': [3, 2] } })
    if (!map.getLayer('draw-active-vertices'))
      map.addLayer({ id: 'draw-active-vertices', type: 'circle', source: 'draw-active',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#6366f1' } })
  }, [])

  // Rebuild GeoJSON sources from refs and push to map
  const updateDrawSources = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.getSource('draw-done')) return
    const done: GeoJSON.Feature[] = drawnFeaturesRef.current.map((f) => {
      if (f.mode === 'point') return { type: 'Feature', geometry: { type: 'Point', coordinates: f.coords[0] }, properties: { id: f.id, label: f.label } }
      if (f.mode === 'line')  return { type: 'Feature', geometry: { type: 'LineString', coordinates: f.coords }, properties: { id: f.id, label: f.label } }
      return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...f.coords, f.coords[0]]] }, properties: { id: f.id, label: f.label } }
    })
    ;(map.getSource('draw-done') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: done })
  }, [])

  const updateActivePreview = useCallback((coords: [number, number][], mode: DrawMode, mousePos?: [number, number]) => {
    const map = mapRef.current
    if (!map || !map.getSource('draw-active')) return
    const preview = mousePos ? [...coords, mousePos] : coords
    const features: GeoJSON.Feature[] = []
    if (mode === 'polygon' && preview.length >= 2) {
      const ring = preview.length >= 3 ? [...preview, preview[0]] : preview
      features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} })
    }
    if ((mode === 'line' || mode === 'polygon') && preview.length >= 2)
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: preview }, properties: {} })
    coords.forEach((c) => features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }))
    ;(map.getSource('draw-active') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features })
  }, [])

  const clearActivePreview = useCallback(() => {
    const map = mapRef.current
    if (map?.getSource('draw-active'))
      (map.getSource('draw-active') as maplibregl.GeoJSONSource).setData(EMPTY_FC)
  }, [])

  // Finish current active drawing and push to completed list
  const finishDraw = useCallback(() => {
    const coords = activeDrawRef.current
    const mode   = drawModeRef.current
    if (!mode || coords.length === 0) return
    if (mode === 'line' && coords.length < 2) { activeDrawRef.current = []; setActiveDrawCoords([]); clearActivePreview(); return }
    if (mode === 'polygon' && coords.length < 3) { activeDrawRef.current = []; setActiveDrawCoords([]); clearActivePreview(); return }

    let label = ''
    if (mode === 'point')   label = `${coords[0][1].toFixed(5)}, ${coords[0][0].toFixed(5)}`
    if (mode === 'line')    label = fmtDist(totalDist(coords))
    if (mode === 'polygon') label = fmtArea(polygonArea(coords))

    const feature: DrawnFeature = { id: Date.now().toString(), mode, coords, label }
    drawnFeaturesRef.current = [...drawnFeaturesRef.current, feature]
    setDrawnFeatures([...drawnFeaturesRef.current])
    activeDrawRef.current = []
    setActiveDrawCoords([])
    clearActivePreview()
    updateDrawSources()
  }, [clearActivePreview, updateDrawSources])

  const deleteDrawnFeature = useCallback((id: string) => {
    drawnFeaturesRef.current = drawnFeaturesRef.current.filter((f) => f.id !== id)
    setDrawnFeatures([...drawnFeaturesRef.current])
    updateDrawSources()
  }, [updateDrawSources])

  const clearAllDraw = useCallback(() => {
    drawnFeaturesRef.current = []
    setDrawnFeatures([])
    activeDrawRef.current = []
    setActiveDrawCoords([])
    clearActivePreview()
    updateDrawSources()
  }, [clearActivePreview, updateDrawSources])

  // Re-add all imported GIS layers (called after basemap switch)
  const reAddImportedLayers = useCallback((map: maplibregl.Map) => {
    importedGeojsonRef.current.forEach((geojson, id) => {
      const layer = importedLayers.find(l => l.id === id)
      if (layer) addGISLayerToMap(map, layer, geojson)
    })
  }, [importedLayers])

  const handleFileImport = useCallback(async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { setImportError(t('map.import.tooBig')); return }
    setImporting(true); setImportError(null)
    try {
      const geojson = await parseGISFile(file, t)
      if (!geojson?.features) throw new Error(t('map.import.invalid'))
      const id = Date.now().toString()
      const color = IMPORT_COLORS[(importedLayers.length) % IMPORT_COLORS.length]
      const layer: ImportedLayer = { id, name: file.name, color, featureCount: geojson.features.length }
      importedGeojsonRef.current.set(id, geojson)
      const map = mapRef.current
      if (map) addGISLayerToMap(map, layer, geojson)
      setImportedLayers(prev => [...prev, layer])
    } catch (e) {
      setImportError(e instanceof Error ? e.message : t('map.import.readError'))
    } finally {
      setImporting(false)
    }
  }, [importedLayers, t])

  const deleteImportedLayer = useCallback((id: string) => {
    const map = mapRef.current
    if (map) removeGISLayerFromMap(map, id)
    importedGeojsonRef.current.delete(id)
    setImportedLayers(prev => prev.filter(l => l.id !== id))
  }, [])

  const exportGeoJSON = useCallback(() => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: drawnFeaturesRef.current.map((f) => {
        if (f.mode === 'point')   return { type: 'Feature', geometry: { type: 'Point', coordinates: f.coords[0] }, properties: { label: f.label } }
        if (f.mode === 'line')    return { type: 'Feature', geometry: { type: 'LineString', coordinates: f.coords }, properties: { label: f.label } }
        return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...f.coords, f.coords[0]]] }, properties: { label: f.label } }
      }),
    }
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'drawn-features.geojson'; a.click()
    URL.revokeObjectURL(url)
  }, [])

  // ── Load data layers ─────────────────────────────────────────────────────────
  const loadDataLayers = useCallback((map: maplibregl.Map) => {
    const vis = visRef.current

    if (!map.getSource('province-src'))
      map.addSource('province-src', { type: 'geojson', data: '/thanh_hoa_province.geojson' })
    if (!map.getSource('districts-src'))
      map.addSource('districts-src', { type: 'geojson', data: '/thanh_hoa_districts.geojson' })

    if (!map.getLayer('province-fill')) map.addLayer({ id: 'province-fill', type: 'fill', source: 'province-src',
      layout: { visibility: vis['province-fill'] ? 'visible' : 'none' },
      paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.06 },
    })
    if (!map.getLayer('province-line')) map.addLayer({ id: 'province-line', type: 'line', source: 'province-src',
      layout: { visibility: vis['province-line'] ? 'visible' : 'none' },
      paint: { 'line-color': '#1d4ed8', 'line-width': 2.5, 'line-opacity': 0.9 },
    })
    if (!map.getLayer('districts-line')) map.addLayer({ id: 'districts-line', type: 'line', source: 'districts-src',
      layout: { visibility: vis['districts-line'] ? 'visible' : 'none' },
      paint: { 'line-color': '#60a5fa', 'line-width': 1, 'line-opacity': 0.6, 'line-dasharray': [3, 2] },
    })
    if (!map.getLayer('districts-label')) map.addLayer({ id: 'districts-label', type: 'symbol', source: 'districts-src',
      minzoom: 8,
      layout: {
        visibility: vis['districts-line'] ? 'visible' : 'none',
        'text-field': ['get', 'NAME_2'], 'text-size': 10, 'text-max-width': 8,
        'text-font': ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
      },
      paint: { 'text-color': '#1d4ed8', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    })

    if (!map.getSource('hotspots'))
      map.addSource('hotspots', { type: 'geojson', data: HOTSPOTS_URL })

    // Cluster source (module 24)
    if (!map.getSource('hotspots-cluster'))
      map.addSource('hotspots-cluster', {
        type: 'geojson',
        data: HOTSPOTS_URL,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
        clusterProperties: { maxConf: ['max', ['get', 'confidence_score']] },
      })
    if (!map.getLayer('hotspots-heat')) map.addLayer({ id: 'hotspots-heat', type: 'heatmap', source: 'hotspots',
      layout: { visibility: vis['hotspots-heat'] ? 'visible' : 'none' },
      paint: {
        // Weight by confidence_score: low=0, medium=0.4, high=0.7, extreme=1
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'confidence_score'],
          0, 0,   50, 0.2,   70, 0.5,   90, 0.8,   100, 1,
        ],
        // Intensity grows with zoom
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 8, 1.5, 12, 2.5],
        // Risk color ramp: transparent → xanh lá (thấp) → vàng (trung) → cam (cao) → đỏ (cực cao)
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
          0,    'rgba(0,0,0,0)',
          0.05, 'rgba(26,152,80,0.3)',
          0.25, 'rgba(102,189,99,0.55)',
          0.45, 'rgba(253,174,97,0.7)',
          0.65, 'rgba(244,109,67,0.82)',
          0.85, 'rgba(215,48,39,0.9)',
          1.0,  'rgba(165,15,21,1)',
        ],
        // Radius shrinks as user zooms in (switch to points at zoom 12+)
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 20, 8, 35, 11, 50, 14, 70],
        // Fade out as points take over
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.9, 13, 0.6, 15, 0.3],
      },
    })
    if (!map.getLayer('hotspots-points')) map.addLayer({ id: 'hotspots-points', type: 'circle', source: 'hotspots',
      minzoom: 11,
      layout: { visibility: vis['hotspots-points'] && !clusterEnabledRef.current ? 'visible' : 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 9],
        'circle-color': '#fbbf24', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9,
      },
    })

    // Cluster layers (module 24)
    const clVis: 'visible' | 'none' = vis['hotspots-points'] && clusterEnabledRef.current ? 'visible' : 'none'
    if (!map.getLayer('clusters'))
      map.addLayer({
        id: 'clusters', type: 'circle', source: 'hotspots-cluster',
        filter: ['has', 'point_count'],
        layout: { visibility: clVis },
        paint: {
          'circle-color': ['step', ['get', 'maxConf'], '#34d399', 50, '#fbbf24', 70, '#f97316', 90, '#ef4444'],
          'circle-radius': ['step', ['get', 'point_count'], 20, 5, 28, 20, 36],
          'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.88,
        },
      })
    if (!map.getLayer('cluster-count'))
      map.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'hotspots-cluster',
        filter: ['has', 'point_count'],
        layout: {
          visibility: clVis,
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#ffffff' },
      })
    if (!map.getLayer('unclustered-point'))
      map.addLayer({
        id: 'unclustered-point', type: 'circle', source: 'hotspots-cluster',
        filter: ['!', ['has', 'point_count']],
        layout: { visibility: clVis },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 9],
          'circle-color': ['step', ['get', 'confidence_score'], '#34d399', 50, '#fbbf24', 70, '#f97316', 90, '#ef4444'],
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9,
        },
      })

    if (!map.getSource('incidents-src'))
      map.addSource('incidents-src', { type: 'geojson', data: INCIDENTS_URL })
    if (!map.getLayer('incidents')) map.addLayer({ id: 'incidents', type: 'circle', source: 'incidents-src',
      layout: { visibility: vis['incidents'] ? 'visible' : 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 8, 14, 18],
        'circle-color': ['match', ['get', 'status'],
          'uncontrolled', '#ef4444', 'containing', '#fbbf24', 'controlled', '#34d399', '#60a5fa',
        ],
        'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9,
      },
    })

    addMeasureLayers(map)
    addDrawLayers(map)
    reAddImportedLayers(map)
    setMapReady(true)
  }, [addMeasureLayers, addDrawLayers, reAddImportedLayers])

  // ── Mount map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    const map = new maplibregl.Map({
      container: el,
      style: BASEMAPS[0].style,
      center: [105.78, 19.80],
      zoom: 8,
      transformRequest: (url) => {
        if (url.includes('/api/')) {
          return {
            url,
            headers: { 'ngrok-skip-browser-warning': 'true' }
          }
        }
        return { url }
      }
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left')
    map.addControl(new maplibregl.FullscreenControl(), 'top-right')

    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '300px', className: 'wf-maplibre-popup' })

    map.on('click', 'hotspots-points', (e) => {
      if (activeToolRef.current) return
      if (!e.features?.[0]) return
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      popupRef.current!.setLngLat(e.lngLat).setHTML(hotspotHtml(e.features[0].properties as Record<string, unknown>, lngLat, tRef.current, localeRef.current)).addTo(map)
    })
    map.on('click', 'incidents', (e) => {
      if (activeToolRef.current) return
      if (!e.features?.[0]) return
      popupRef.current!.setLngLat(e.lngLat).setHTML(incidentHtml(e.features[0].properties as Record<string, unknown>, tRef.current)).addTo(map)
    })

    // Draw tool click
    map.on('click', (e) => {
      if (activeToolRef.current !== 'draw') return
      const mode = drawModeRef.current
      if (!mode) return
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      if (mode === 'point') {
        activeDrawRef.current = [pt]
        setActiveDrawCoords([pt])
        // point completes immediately
        const label = `${pt[1].toFixed(5)}, ${pt[0].toFixed(5)}`
        const feature: DrawnFeature = { id: Date.now().toString(), mode: 'point', coords: [pt], label }
        drawnFeaturesRef.current = [...drawnFeaturesRef.current, feature]
        setDrawnFeatures([...drawnFeaturesRef.current])
        activeDrawRef.current = []
        setActiveDrawCoords([])
        updateDrawSources()
        clearActivePreview()
      } else {
        activeDrawRef.current = [...activeDrawRef.current, pt]
        setActiveDrawCoords([...activeDrawRef.current])
        updateActivePreview(activeDrawRef.current, mode)
      }
    })

    // Draw tool double-click — finish line/polygon
    map.on('dblclick', () => {
      if (activeToolRef.current !== 'draw') return
      const mode = drawModeRef.current
      if (mode === 'line' || mode === 'polygon') {
        // remove the extra point added by the preceding click
        if (activeDrawRef.current.length > 0)
          activeDrawRef.current = activeDrawRef.current.slice(0, -1)
        finishDraw()
      }
    })

    // Draw tool mousemove — rubber-band preview
    map.on('mousemove', (e) => {
      if (activeToolRef.current !== 'draw') return
      const mode = drawModeRef.current
      if (!mode || mode === 'point' || activeDrawRef.current.length === 0) return
      updateActivePreview(activeDrawRef.current, mode, [e.lngLat.lng, e.lngLat.lat])
    })

    // Measure tool click
    map.on('click', (e) => {
      if (activeToolRef.current !== 'measure') return
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      measurePtsRef.current = [...measurePtsRef.current, pt]
      setMeasurePts([...measurePtsRef.current])

      const lineData: GeoJSON.FeatureCollection = measurePtsRef.current.length >= 2
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: measurePtsRef.current }, properties: {} }] }
        : EMPTY_FC
      if (map.getSource('measure-line'))
        (map.getSource('measure-line') as maplibregl.GeoJSONSource).setData(lineData)

      const el = document.createElement('div')
      el.className = 'measure-marker'
      el.style.cssText = `width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)`
      const marker = new maplibregl.Marker({ element: el }).setLngLat(pt).addTo(map)
      mMarkersRef.current.push(marker)
    })

    map.on('mouseenter', 'hotspots-points',   () => { if (!activeToolRef.current) map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'hotspots-points',   () => { if (!activeToolRef.current) map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'incidents',         () => { if (!activeToolRef.current) map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'incidents',         () => { if (!activeToolRef.current) map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'clusters',          () => { if (!activeToolRef.current) map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'clusters',          () => { if (!activeToolRef.current) map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'unclustered-point', () => { if (!activeToolRef.current) map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'unclustered-point', () => { if (!activeToolRef.current) map.getCanvas().style.cursor = '' })

    // Cluster click — zoom in to expand (module 24)
    map.on('click', 'clusters', (e) => {
      if (activeToolRef.current) return
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
      if (!features.length) return
      const clusterId = features[0].properties?.cluster_id as number
      const src = map.getSource('hotspots-cluster') as maplibregl.GeoJSONSource
      src.getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number]
          map.easeTo({ center: coords, zoom, duration: 500 })
        })
        .catch(() => {})
    })

    // Unclustered point click — show popup (module 24)
    map.on('click', 'unclustered-point', (e) => {
      if (activeToolRef.current) return
      if (!e.features?.[0]) return
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      popupRef.current!.setLngLat(e.lngLat).setHTML(hotspotHtml(e.features[0].properties as Record<string, unknown>, lngLat, tRef.current, localeRef.current)).addTo(map)
    })

    map.on('load', () => loadDataLayers(map))
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; setMapReady(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDataLayers])

  // Sync visibility
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    LAYER_DEFS.forEach(({ id }) => {
      if (!map.getLayer(id)) return
      // hotspots-points visibility is managed by cluster effect when clustering is on
      if (id === 'hotspots-points' && clusterEnabledRef.current) return
      map.setLayoutProperty(id, 'visibility', visible[id] ? 'visible' : 'none')
    })
    if (map.getLayer('districts-label'))
      map.setLayoutProperty('districts-label', 'visibility', visible['districts-line'] ? 'visible' : 'none')
  }, [visible, mapReady])

  // Sync cluster layers when clusterEnabled or hotspots visibility changes (module 24)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const pointsOn = visible['hotspots-points']
    const clVis: 'visible' | 'none' = pointsOn && clusterEnabled ? 'visible' : 'none'
    ;['clusters', 'cluster-count', 'unclustered-point'].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', clVis)
    })
    if (map.getLayer('hotspots-points'))
      map.setLayoutProperty('hotspots-points', 'visibility',
        pointsOn && !clusterEnabled ? 'visible' : 'none')
  }, [clusterEnabled, visible, mapReady])

  // ── Basemap switch ───────────────────────────────────────────────────────────
  function switchBasemap(bmId: string) {
    const map = mapRef.current
    if (!map || bmId === basemap) return
    const bm = BASEMAPS.find((b) => b.id === bmId)
    if (!bm) return
    setBasemap(bmId)
    setMapReady(false)
    map.setStyle(bm.style)
    map.once('style.load', () => loadDataLayers(map))
  }

  function toggleLayer(id: LayerId) {
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Go-To action ─────────────────────────────────────────────────────────────
  function handleGoTo() {
    const map = mapRef.current
    if (!map) return
    const lat = parseFloat(gotoLat), lng = parseFloat(gotoLng), zoom = parseFloat(gotoZoom)
    if (isNaN(lat) || isNaN(lng)) return
    gotoMarkerRef.current?.remove()
    gotoMarkerRef.current = new maplibregl.Marker({ color: '#1565c0' }).setLngLat([lng, lat]).addTo(map)
    map.flyTo({ center: [lng, lat], zoom: isNaN(zoom) ? 12 : zoom, duration: 1200 })
  }

  // ── Bookmark actions ─────────────────────────────────────────────────────────
  function saveBookmark() {
    const map = mapRef.current
    if (!map) return
    const name = bmNameInput.trim() || `${t('map.bookmark.default')} ${bookmarks.length + 1}`
    const bm: Bookmark = {
      id: Date.now().toString(),
      name,
      center: [map.getCenter().lng, map.getCenter().lat],
      zoom: map.getZoom(),
    }
    const updated = [...bookmarks, bm]
    setBookmarks(updated)
    localStorage.setItem('wf-bookmarks', JSON.stringify(updated))
    setBmNameInput('')
  }

  function flyToBookmark(bm: Bookmark) {
    mapRef.current?.flyTo({ center: bm.center, zoom: bm.zoom, duration: 1000 })
  }

  function deleteBookmark(id: string) {
    const updated = bookmarks.filter((b) => b.id !== id)
    setBookmarks(updated)
    localStorage.setItem('wf-bookmarks', JSON.stringify(updated))
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ width: '100%', height: 'calc(100vh - 44px)', position: 'relative' }}>

      {/* ── Layer control panel (left) ───────────────────────────────────────── */}
      <div className="absolute top-3 left-3 z-10 w-52 bg-white/95 border border-[#e2e8f0] rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <span className="material-symbols-outlined text-[#1565c0] text-base">layers</span>
          <span className="text-xs font-semibold text-[#1e293b]">{t('map.layers')}</span>
        </div>
        <div className="p-3 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-1.5">{t('map.basemap')}</p>
            <div className="flex gap-1">
              {BASEMAPS.map((bm) => (
                <button key={bm.id} onClick={() => switchBasemap(bm.id)}
                  className={`flex-1 py-1.5 text-[10px] rounded-lg border transition-all ${
                    basemap === bm.id
                      ? 'bg-[#1565c0] border-[#1565c0] text-white font-semibold'
                      : 'border-[#e2e8f0] text-[#64748b] hover:text-[#1e293b] hover:border-[#1565c0]'
                  }`}
                >{basemapLabels[bm.id]}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-1">{t('map.dataLayers')}</p>
            <div className="space-y-0.5">
              {LAYER_DEFS.map(({ id, color, icon }) => {
                const on = visible[id]
                return (
                  <div key={id}>
                    <button onClick={() => toggleLayer(id)}
                      className="w-full flex items-center gap-2.5 px-1.5 py-2 rounded-lg hover:bg-[#f1f5f9] transition-colors"
                    >
                      <div className="w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition-all"
                        style={{ backgroundColor: on ? color : 'transparent', borderColor: on ? color : '#cbd5e1' }}>
                        {on && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5 L4 7.5 L8.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="material-symbols-outlined text-sm flex-shrink-0" style={{ color: on ? color : '#cbd5e1' }}>{icon}</span>
                      <span className={`text-xs flex-1 text-left leading-tight ${on ? 'text-[#1e293b]' : 'text-[#94a3b8]'}`}>{layerLabels[id]}</span>
                    </button>
                    {id === 'hotspots-points' && on && (
                      <button
                        onClick={() => setClusterEnabled(p => !p)}
                        className={`ml-7 mb-1 flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] border transition-all ${
                          clusterEnabled
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'border-[#e2e8f0] text-[#94a3b8] hover:border-amber-300 hover:text-amber-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xs">hub</span>
                        {clusterEnabled ? t('map.cluster.on') : t('map.cluster.off')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {!mapReady && (
            <div className="flex items-center gap-2 text-[10px] text-[#94a3b8]">
              <div className="w-2 h-2 rounded-full bg-[#1565c0] animate-pulse" />
              {t('map.loading')}
            </div>
          )}
        </div>
      </div>

      {/* ── Tools toolbar (top centre) ───────────────────────────────────────── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex gap-1 bg-white/95 border border-[#e2e8f0] rounded-xl shadow-lg backdrop-blur-sm p-1">
        {([
          { id: 'goto',     icon: 'my_location'  },
          { id: 'measure',  icon: 'straighten'   },
          { id: 'draw',     icon: 'draw'         },
          { id: 'heatmap',  icon: 'local_fire_department' },
          { id: 'bookmark', icon: 'bookmark'     },
          { id: 'import',   icon: 'upload_file'  },
        ] as const).map(({ id, icon }) => (
          <button
            key={id}
            onClick={() => toggleTool(id)}
            title={t(`map.tools.${id}`)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTool === id
                ? 'bg-[#1565c0] text-white shadow-sm'
                : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b]'
            }`}
          >
            <span className="material-symbols-outlined text-base">{icon}</span>
            <span className="hidden sm:inline">{t(`map.tools.${id}`)}</span>
            {id === 'bookmark' && bookmarks.length > 0 && (
              <span className={`text-[10px] px-1 py-0.5 rounded-full leading-none ${activeTool === id ? 'bg-white/20 text-white' : 'bg-[#1565c0] text-white'}`}>
                {bookmarks.length}
              </span>
            )}
            {id === 'draw' && drawnFeatures.length > 0 && (
              <span className={`text-[10px] px-1 py-0.5 rounded-full leading-none ${activeTool === id ? 'bg-white/20 text-white' : 'bg-[#1565c0] text-white'}`}>
                {drawnFeatures.length}
              </span>
            )}
            {id === 'import' && importedLayers.length > 0 && (
              <span className={`text-[10px] px-1 py-0.5 rounded-full leading-none ${activeTool === id ? 'bg-white/20 text-white' : 'bg-[#7c3aed] text-white'}`}>
                {importedLayers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tool panels (right side) ─────────────────────────────────────────── */}
      {activeTool === 'goto' && (
        <div className="absolute top-14 right-3 z-10 w-64 bg-white/95 border border-[#e2e8f0] rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <span className="material-symbols-outlined text-[#1565c0] text-base">my_location</span>
            <span className="text-xs font-semibold text-[#1e293b]">{t('map.goto.title')}</span>
          </div>
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1">{t('map.goto.lat')}</label>
                <input value={gotoLat} onChange={(e) => setGotoLat(e.target.value)}
                  placeholder="19.8000"
                  className="w-full px-2 py-1.5 text-xs border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#1565c0] text-[#1e293b] font-mono" />
              </div>
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1">{t('map.goto.lng')}</label>
                <input value={gotoLng} onChange={(e) => setGotoLng(e.target.value)}
                  placeholder="105.7800"
                  className="w-full px-2 py-1.5 text-xs border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#1565c0] text-[#1e293b] font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-[#94a3b8] mb-1">{t('map.goto.zoom')}</label>
              <input value={gotoZoom} onChange={(e) => setGotoZoom(e.target.value)}
                placeholder="12" type="number" min="1" max="18"
                className="w-full px-2 py-1.5 text-xs border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#1565c0] text-[#1e293b] font-mono" />
            </div>
            <button onClick={handleGoTo}
              className="w-full py-1.5 text-xs font-medium text-white bg-[#1565c0] rounded-lg hover:bg-[#1251a3] flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-sm">near_me</span>
              {t('map.goto.fly')}
            </button>
            <p className="text-[10px] text-[#94a3b8] text-center">{t('map.goto.note')}</p>
          </div>
        </div>
      )}

      {activeTool === 'measure' && (
        <div className="absolute top-14 right-3 z-10 w-64 bg-white/95 border border-[#e2e8f0] rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <span className="material-symbols-outlined text-[#1565c0] text-base">straighten</span>
            <span className="text-xs font-semibold text-[#1e293b]">{t('map.measure.title')}</span>
          </div>
          <div className="p-3 space-y-3">
            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-700 flex items-start gap-2">
              <span className="material-symbols-outlined text-sm mt-0.5">info</span>
              <span>{t('map.measure.hint')}</span>
            </div>
            {measurePts.length >= 2 ? (
              <div className="text-center py-2">
                <p className="text-[10px] text-[#94a3b8] mb-1">{t('map.measure.total')}</p>
                <p className="text-2xl font-bold text-[#1565c0]">{fmtDist(totalDist(measurePts))}</p>
                <p className="text-[10px] text-[#94a3b8] mt-1">{t('map.measure.points', { count: measurePts.length })}</p>
              </div>
            ) : (
              <p className="text-center text-xs text-[#94a3b8] py-2">
                {measurePts.length === 0 ? t('map.measure.noPoints') : t('map.measure.needMore')}
              </p>
            )}
            {measurePts.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1">
                {measurePts.map((pt, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-[#64748b] font-mono">
                    <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[9px] flex items-center justify-center font-semibold flex-shrink-0">{i + 1}</span>
                    {pt[1].toFixed(5)}, {pt[0].toFixed(5)}
                    {i > 0 && (
                      <span className="ml-auto text-[#94a3b8]">{fmtDist(haversine(measurePts[i - 1], pt))}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {measurePts.length > 0 && (
              <button onClick={clearMeasure}
                className="w-full py-1.5 text-xs text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-sm">delete</span>
                {t('map.measure.clear')}
              </button>
            )}
          </div>
        </div>
      )}

      {activeTool === 'draw' && (
        <div className="absolute top-14 right-3 z-10 w-72 bg-white/95 border border-[#e2e8f0] rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#1565c0] text-base">draw</span>
              <span className="text-xs font-semibold text-[#1e293b]">{t('map.draw.title')}</span>
            </div>
            {drawnFeatures.length > 0 && (
              <button onClick={exportGeoJSON} title="Xuất GeoJSON"
                className="flex items-center gap-1 text-[10px] text-[#1565c0] hover:underline">
                <span className="material-symbols-outlined text-sm">download</span>GeoJSON
              </button>
            )}
          </div>
          <div className="p-3 space-y-3">
            {/* Mode buttons */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-1.5">{t('map.draw.selectTool')}</p>
              <div className="grid grid-cols-3 gap-1">
                {([
                  { mode: 'point',   icon: 'location_on' },
                  { mode: 'line',    icon: 'polyline'    },
                  { mode: 'polygon', icon: 'pentagon'    },
                ] as const).map(({ mode: m, icon }) => (
                  <button key={m} onClick={() => setDrawMode(drawMode === m ? null : m)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs transition-all ${
                      drawMode === m
                        ? 'bg-[#1565c0] border-[#1565c0] text-white'
                        : 'border-[#e2e8f0] text-[#64748b] hover:border-[#1565c0] hover:text-[#1565c0]'
                    }`}>
                    <span className="material-symbols-outlined text-base">{icon}</span>
                    {t(`map.draw.${m}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Instruction */}
            {drawMode && (
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700 flex items-start gap-2">
                <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0">info</span>
                <span>
                  {drawMode === 'point'   && t('map.draw.hintPoint')}
                  {drawMode === 'line'    && t('map.draw.hintLine')}
                  {drawMode === 'polygon' && t('map.draw.hintPolygon')}
                </span>
              </div>
            )}

            {/* Active drawing progress */}
            {activeDrawCoords.length > 0 && (
              <div className="flex items-center justify-between text-xs text-[#64748b] bg-[#f8fafc] rounded-lg px-3 py-2">
                <span>{t('map.draw.progress', { count: activeDrawCoords.length })}</span>
                {drawMode === 'line' && activeDrawCoords.length >= 2 && (
                  <span className="text-[#1565c0] font-medium">{fmtDist(totalDist(activeDrawCoords))}</span>
                )}
                {drawMode === 'polygon' && activeDrawCoords.length >= 3 && (
                  <span className="text-[#1565c0] font-medium">{fmtArea(polygonArea(activeDrawCoords))}</span>
                )}
              </div>
            )}

            {/* Completed features list */}
            {drawnFeatures.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-[#94a3b8]">{t('map.draw.done', { count: drawnFeatures.length })}</p>
                  <button onClick={clearAllDraw}
                    className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">delete_sweep</span>{t('map.draw.clearAll')}
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {drawnFeatures.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#f8fafc] group">
                      <span className={`material-symbols-outlined text-sm flex-shrink-0 ${
                        f.mode === 'point' ? 'text-emerald-600' : f.mode === 'line' ? 'text-purple-600' : 'text-blue-600'
                      }`}>
                        {f.mode === 'point' ? 'location_on' : f.mode === 'line' ? 'polyline' : 'pentagon'}
                      </span>
                      <span className="flex-1 text-xs text-[#1e293b] truncate">{f.label}</span>
                      <button onClick={() => deleteDrawnFeature(f.id)}
                        className="opacity-0 group-hover:opacity-100 text-[#94a3b8] hover:text-red-500 transition-all flex-shrink-0">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!drawMode && drawnFeatures.length === 0 && (
              <p className="text-center text-[11px] text-[#94a3b8] py-1">{t('map.draw.empty')}</p>
            )}
          </div>
        </div>
      )}

      {activeTool === 'heatmap' && (
        <div className="absolute top-14 right-3 z-10 w-72 bg-white/95 border border-[#e2e8f0] rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <span className="material-symbols-outlined text-red-500 text-base">local_fire_department</span>
            <span className="text-xs font-semibold text-[#1e293b]">{t('map.heatmap.title')}</span>
          </div>
          <div className="p-4 space-y-4">

            {/* Color legend */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-2">{t('map.heatmap.riskLevel')}</p>
              <div className="rounded-lg overflow-hidden border border-[#e2e8f0]">
                {[
                  { label: t('map.heatmap.extreme'), bg: 'bg-red-600',    text: 'text-white' },
                  { label: t('map.heatmap.high'),    bg: 'bg-orange-500', text: 'text-white' },
                  { label: t('map.heatmap.medium'),  bg: 'bg-amber-400',  text: 'text-white' },
                  { label: t('map.heatmap.low'),     bg: 'bg-emerald-500',text: 'text-white' },
                ].map(({ label, bg, text }) => (
                  <div key={label} className={`${bg} px-3 py-1.5 flex items-center gap-2`}>
                    <div className="w-2 h-2 rounded-full bg-white/70 flex-shrink-0" />
                    <span className={`text-[11px] font-medium ${text}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Radius slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#64748b]">{t('map.heatmap.radius')}</label>
                <span className="text-xs font-mono text-[#1565c0] font-semibold">{hmRadius} px</span>
              </div>
              <input type="range" min={10} max={80} value={hmRadius}
                onChange={(e) => setHmRadius(Number(e.target.value))}
                className="w-full accent-[#1565c0] h-1.5 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-[#94a3b8] mt-1">
                <span>{t('map.heatmap.detail')}</span><span>{t('map.heatmap.overview')}</span>
              </div>
            </div>

            {/* Intensity slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#64748b]">{t('map.heatmap.intensity')}</label>
                <span className="text-xs font-mono text-[#1565c0] font-semibold">{(hmIntensity / 10).toFixed(1)}×</span>
              </div>
              <input type="range" min={5} max={40} value={hmIntensity}
                onChange={(e) => setHmIntensity(Number(e.target.value))}
                className="w-full accent-[#1565c0] h-1.5 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-[#94a3b8] mt-1">
                <span>{t('map.heatmap.colorLight')}</span><span>{t('map.heatmap.colorDark')}</span>
              </div>
            </div>

            {/* Min confidence filter */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#64748b]">{t('map.heatmap.minConf')}</label>
                <span className="text-xs font-mono text-[#1565c0] font-semibold">
                  {hmMinConf === 0 ? t('map.heatmap.all') : `${hmMinConf}%`}
                </span>
              </div>
              <input type="range" min={0} max={90} step={10} value={hmMinConf}
                onChange={(e) => setHmMinConf(Number(e.target.value))}
                className="w-full accent-[#ef4444] h-1.5 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-[#94a3b8] mt-1">
                <span>{t('map.heatmap.all')}</span><span>{t('map.heatmap.extremeOnly')}</span>
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={() => { setHmRadius(35); setHmIntensity(15); setHmMinConf(0) }}
              className="w-full py-1.5 text-xs text-[#64748b] border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
              {t('map.heatmap.reset')}
            </button>
          </div>
        </div>
      )}

      {activeTool === 'bookmark' && (
        <div className="absolute top-14 right-3 z-10 w-64 bg-white/95 border border-[#e2e8f0] rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <span className="material-symbols-outlined text-[#1565c0] text-base">bookmark</span>
            <span className="text-xs font-semibold text-[#1e293b]">{t('map.bookmark.title')}</span>
          </div>
          <div className="p-3 space-y-3">
            {/* Save current view */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-[#94a3b8]">{t('map.bookmark.save')}</p>
              <div className="flex gap-1.5">
                <input value={bmNameInput} onChange={(e) => setBmNameInput(e.target.value)}
                  placeholder={t('map.bookmark.namePlaceholder')}
                  onKeyDown={(e) => e.key === 'Enter' && saveBookmark()}
                  className="flex-1 px-2 py-1.5 text-xs border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#1565c0] text-[#1e293b]" />
                <button onClick={saveBookmark}
                  className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#1565c0] rounded-lg hover:bg-[#1251a3]">
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              </div>
            </div>

            {/* Bookmark list */}
            <div>
              <p className="text-[10px] text-[#94a3b8] mb-1.5">{t('map.bookmark.list', { count: bookmarks.length })}</p>
              {bookmarks.length === 0 ? (
                <p className="text-xs text-[#94a3b8] text-center py-3">{t('map.bookmark.none')}</p>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {bookmarks.map((bm) => (
                    <div key={bm.id} className="flex items-center gap-1.5 group p-1.5 rounded-lg hover:bg-[#f8fafc]">
                      <button onClick={() => flyToBookmark(bm)} className="flex-1 text-left min-w-0">
                        <p className="text-xs font-medium text-[#1e293b] truncate">{bm.name}</p>
                        <p className="text-[10px] text-[#94a3b8] font-mono">
                          {bm.center[1].toFixed(4)}, {bm.center[0].toFixed(4)} · z{bm.zoom.toFixed(1)}
                        </p>
                      </button>
                      <button onClick={() => deleteBookmark(bm.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-[#94a3b8] hover:text-red-500 transition-all flex-shrink-0">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Import GIS panel ─────────────────────────────────────────────── */}
      {activeTool === 'import' && (
        <div className="absolute top-14 right-3 z-10 w-72 bg-white/95 border border-[#e2e8f0] rounded-xl shadow-lg backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <span className="material-symbols-outlined text-[#7c3aed] text-base">upload_file</span>
            <span className="text-xs font-semibold text-[#1e293b]">{t('map.import.title')}</span>
          </div>
          <div className="p-3 space-y-3">
            {/* Drop zone */}
            <label
              className="flex flex-col items-center justify-center gap-2 w-full h-28 border-2 border-dashed border-[#c4b5fd] rounded-xl bg-[#faf5ff] hover:bg-[#f3e8ff] transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) handleFileImport(file)
              }}
            >
              <input type="file" className="hidden" accept=".geojson,.json,.kml,.zip"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileImport(f); e.target.value = '' }} />
              {importing ? (
                <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-2xl text-[#7c3aed]">cloud_upload</span>
                  <p className="text-xs text-[#7c3aed] font-medium text-center leading-snug">
                    {t('map.import.drop')}
                  </p>
                </>
              )}
            </label>

            <p className="text-[10px] text-[#94a3b8] text-center">
              {t('map.import.formats')}
            </p>

            {/* Error */}
            {importError && (
              <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0">error</span>
                <span>{importError}</span>
              </div>
            )}

            {/* Imported layers list */}
            {importedLayers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-[#94a3b8]">{t('map.import.layers', { count: importedLayers.length })}</p>
                  <button onClick={() => { importedLayers.forEach(l => deleteImportedLayer(l.id)) }}
                    className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">delete_sweep</span>{t('map.import.clearAll')}
                  </button>
                </div>
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {importedLayers.map((layer) => (
                    <div key={layer.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#f8fafc] group">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: layer.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#1e293b] truncate">{layer.name}</p>
                        <p className="text-[10px] text-[#94a3b8]">{t('map.import.features', { count: layer.featureCount })}</p>
                      </div>
                      <button onClick={() => deleteImportedLayer(layer.id)}
                        className="opacity-0 group-hover:opacity-100 text-[#94a3b8] hover:text-red-500 transition-all flex-shrink-0">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importedLayers.length === 0 && !importing && !importError && (
              <p className="text-center text-[11px] text-[#94a3b8]">{t('map.import.none')}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Legend ───────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-8 left-3 z-10 bg-white/95 border border-[#e2e8f0] rounded-xl p-3 shadow-lg backdrop-blur-sm">
        <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-2.5">{t('map.legend.title')}</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-2.5 flex-shrink-0 rounded-sm border-2 border-[#1d4ed8]" style={{ backgroundColor: 'rgba(59,130,246,0.15)' }} />
            <span className="text-[10px] text-[#64748b]">{t('map.legend.provinceBoundary')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0 flex-shrink-0 border-t border-dashed border-[#60a5fa]" style={{ borderTopWidth: 1.5 }} />
            <span className="text-[10px] text-[#64748b]">{t('map.legend.districtBoundary')}</span>
          </div>
          <div className="space-y-1">
            <div className="w-full h-2.5 rounded-full flex-shrink-0"
              style={{ background: 'linear-gradient(to right, rgba(26,152,80,0.5), rgba(253,174,97,0.8), rgba(244,109,67,0.9), rgba(165,15,21,1))' }} />
            <div className="flex justify-between text-[9px] text-[#94a3b8]">
              <span>{t('map.legend.low')}</span><span>{t('map.legend.medium')}</span><span>{t('map.legend.high')}</span><span>{t('map.legend.extreme')}</span>
            </div>
          </div>
          {clusterEnabled ? (
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest text-[#94a3b8]">{t('map.legend.cluster')}</p>
              {[
                { color: '#ef4444', label: t('map.legend.clusterExtreme') },
                { color: '#f97316', label: t('map.legend.clusterHigh') },
                { color: '#fbbf24', label: t('map.legend.clusterMedium') },
                { color: '#34d399', label: t('map.legend.clusterLow') },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-[#64748b]">{label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0 bg-[#fbbf24]" />
              <span className="text-[10px] text-[#64748b]">{t('map.legend.hotspot')}</span>
            </div>
          )}
          {[
            { color: '#ef4444', label: t('map.legend.uncontrolled') },
            { color: '#fbbf24', label: t('map.legend.containing') },
            { color: '#34d399', label: t('map.legend.controlled') },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border border-[#e2e8f0] flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-[#64748b]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

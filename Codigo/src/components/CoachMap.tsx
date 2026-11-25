import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, LocateFixed, MapPin, Minus, Plus, Search, X } from 'lucide-react'
import * as maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapPerson } from '../../shared/contracts'
import { useAuth } from '../context/AuthContext'
import { api, json } from '../services/api'
import './CoachMap.css'

type Point = readonly [number, number] // [lat, lon]
type Coach = MapPerson
const defaultCity = 'São Paulo, SP'
const defaultPoint: Point = [-23.55, -46.65]
const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
const roleLabel = (person: Coach) =>
  person.role === 'coach' ? (person.verified ? 'Treinador verificado' : 'Treinador') : 'Atleta'
const describe = (person: Coach) =>
  [roleLabel(person), person.sports.slice(0, 2).join(', ')].filter(Boolean).join(' · ')
function Avatar({ person }: { person: Coach }) {
  return person.photoUpdatedAt
    ? <img className="coach-map-avatar coach-map-avatar--photo" alt=""
      src={`/api/profiles/${person.userId}/photo?v=${encodeURIComponent(person.photoUpdatedAt)}`} />
    : <span className="coach-map-avatar" style={{ background: person.role === 'coach' ? '#d7f266' : '#8ecae6' }}>
      {initialsOf(person.name)}
    </span>
}

const motionOk = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
const cameraEase = 'cubic-bezier(.76, 0, .24, 1)'

// Vite pre-bundling breaks MapLibre's relative worker URL, so hand it a Vite-bundled worker instead
maplibregl.setWorkerUrl(mapWorkerUrl)

// ---------- map style: CARTO Dark Matter with LinkAtletas-green place names ----------
const accent = '#d7f266'
const styleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
let stylePromise: Promise<StyleSpecification> | null = null
const loadStyle = () => stylePromise ??= fetch(styleUrl)
  .then(response => {
    if (!response.ok) throw new Error('style ' + response.status)
    return response.json() as Promise<StyleSpecification>
  })
  .then(style => ({
    ...style,
    layers: style.layers.map(layer => layer.type === 'symbol' && layer.id.startsWith('place_')
      ? { ...layer, paint: { ...layer.paint, 'text-color': accent } }
      : layer),
  }))
  .catch(error => { stylePromise = null; throw error })

// ---------- positions & distances ----------
// Backend already rounds to ~1 km; people in the same cell get a small deterministic offset so pins don't stack.
const coachPoint = (coach: Coach): Point => {
  const seed = [...coach.userId].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const angle = seed * 2.399
  const radius = 0.002 + (seed % 4) * 0.001
  return [coach.lat + Math.sin(angle) * radius, coach.lon + Math.cos(angle) * radius]
}
const distanceKm = ([lat1, lon1]: Point, [lat2, lon2]: Point) => {
  const rad = Math.PI / 180
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(a))
}
const formatDistance = (km: number) => km < 1
  ? `${Math.round(km * 1000)} m`
  : `${km.toLocaleString('pt-BR', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ---------- map ----------
type MapViewProps = {
  center: Point
  me: Point
  people?: Coach[]
  interactive?: boolean
  selectedId?: string
  onSelect?: (coach: Coach) => void
  mapRef?: React.RefObject<maplibregl.Map | null>
}

function MapView({ center, me, people = [], interactive = false, selectedId, onSelect, mapRef }: MapViewProps) {
  const box = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const initial = useRef(center)
  const select = useRef(onSelect)
  useEffect(() => { select.current = onSelect }, [onSelect])

  useEffect(() => {
    let instance: maplibregl.Map | null = null
    let alive = true
    loadStyle().then(style => {
      if (!alive || !box.current) return
      const [lat, lon] = initial.current
      try {
        instance = new maplibregl.Map({
          container: box.current, style, center: [lon, lat], zoom: 13, interactive,
          attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false,
        })
      } catch {
        // sem WebGL (aceleração de hardware desligada / VM sem GPU) o construtor lança
        setFailed(true)
        return
      }
      instance.getCanvas().addEventListener('webglcontextlost', () => alive && setFailed(true))
      instance.touchZoomRotate?.disableRotation()
      instance.once('load', () => alive && setLoaded(true))
      if (mapRef) mapRef.current = instance
      setMap(instance)
    }, () => alive && setFailed(true))
    return () => {
      alive = false
      instance?.remove()
      if (mapRef) mapRef.current = null
    }
  }, [interactive, mapRef])

  // follow the requested center
  const [lat, lon] = center
  useEffect(() => {
    if (!map) return
    if (interactive && motionOk()) map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 13), duration: 1400, essential: true })
    else map.jumpTo({ center: [lon, lat] })
  }, [map, lat, lon, interactive])

  // "you are here" pulse
  const [meLat, meLon] = me
  useEffect(() => {
    if (!map) return
    const el = document.createElement('span')
    el.className = 'coach-map-me'
    el.setAttribute('aria-hidden', 'true')
    const marker = new maplibregl.Marker({ element: el }).setLngLat([meLon, meLat]).addTo(map)
    return () => { marker.remove() }
  }, [map, meLat, meLon])

  // coach pins (fullscreen only)
  useEffect(() => {
    if (!map || !interactive) return
    const markers = people.map(coach => {
      const [cLat, cLon] = coachPoint(coach)
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'coach-map-pin' + (coach.role === 'athlete' ? ' is-athlete' : '') + (coach.userId === selectedId ? ' is-selected' : '')
      const shape = document.createElement('span') // slim tapered pin; the button itself is positioned by MapLibre
      shape.className = 'coach-map-pin-shape'
      shape.setAttribute('aria-hidden', 'true')
      shape.innerHTML =
        '<svg viewBox="0 0 24 42" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path fill="currentColor" stroke="#111" stroke-width="1.2" fill-rule="evenodd" clip-rule="evenodd" ' +
        'd="M12 1.5C6.75 1.5 2.5 5.75 2.5 11C2.5 17.4 8.4 25.4 10.65 37.6C10.95 39.25 11.4 40.5 12 40.5C12.6 40.5 13.05 39.25 13.35 37.6C15.6 25.4 21.5 17.4 21.5 11C21.5 5.75 17.25 1.5 12 1.5ZM12 7A4 4 0 1 0 12 15A4 4 0 1 0 12 7Z"/>' +
        '</svg>'
      el.append(shape)
      el.setAttribute('aria-label', `Ver ${coach.name}`)
      el.addEventListener('click', event => { event.stopPropagation(); select.current?.(coach) })
      return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([cLon, cLat]).addTo(map)
    })
    return () => markers.forEach(marker => marker.remove())
  }, [map, interactive, selectedId, people])

  return <div className={'coach-map-frame' + (loaded ? ' is-loaded' : '') + (failed ? ' is-failed' : '')} aria-hidden={!interactive}
    role={interactive ? 'region' : undefined} aria-label={interactive ? 'Mapa da região' : undefined}>
    <div ref={box} className="coach-map-canvas" />
    {failed && <p className="coach-map-error">Não foi possível desenhar o mapa. Ative a aceleração de hardware do navegador (Configurações › Sistema) e recarregue a página.</p>}
  </div>
}

// ---------- search (results = coaches nearest to you) ----------
function CoachPicker({ value, people, onChange }: { value: Coach; people: Coach[]; onChange: (coach: Coach) => void }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const choose = (coach: Coach) => { onChange(coach); setOpen(false) }
  return <div className={'coach-map-picker' + (open ? ' is-open' : '')}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false) }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        const index = people.findIndex(item => item.userId === value.userId)
        if (open) onChange(people[(index + step + people.length) % people.length])
        else setOpen(true)
      }
    }}>
    <span id={`${id}-label`} className="coach-map-picker-label">Pessoas no mapa</span>
    <button type="button" className="coach-map-picker-button" aria-haspopup="listbox" aria-expanded={open}
      aria-labelledby={`${id}-label ${id}-value`} onClick={() => setOpen(o => !o)}>
      <span id={`${id}-value`}>{value.name}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    <div className="coach-map-picker-panel">
      <ul role="listbox" aria-labelledby={`${id}-label`} className="coach-map-picker-list">
        {people.map(item => <li key={item.userId} role="option" aria-selected={item.userId === value.userId}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}>
          <Avatar person={item} />
          <span className="coach-map-result-text"><strong>{item.name}</strong><small>{describe(item)}</small></span>
          {item.userId === value.userId && <Check size={16} aria-hidden="true" />}
        </li>)}
      </ul>
    </div>
  </div>
}

function CoachSearch({ origin, people, onPick }: { origin: Point; people: Coach[]; onPick: (coach: Coach) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => {
    const terms = normalize(query.trim()).split(/\s+/).filter(Boolean)
    return people
      .map(coach => ({ coach, km: distanceKm(origin, coachPoint(coach)) }))
      .filter(({ coach }) => {
        const haystack = normalize([coach.name, roleLabel(coach), coach.city, ...coach.sports].join(' '))
        return terms.every(term => haystack.includes(term))
      })
      .sort((a, b) => a.km - b.km)
  }, [query, origin, people])
  const pick = (coach: Coach) => {
    onPick(coach)
    setOpen(false)
    input.current?.blur()
  }

  return <div className={'coach-map-search' + (open ? ' is-open' : '')}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <label className="coach-map-search-field">
      <Search size={18} aria-hidden="true" />
      <input ref={input} type="search" role="combobox" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && results[active] ? `${listId}-${results[active].coach.userId}` : undefined}
        aria-label="Buscar pessoas próximas" placeholder="Buscar treinadores e atletas" value={query}
        onFocus={() => setOpen(true)}
        onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true) }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            const step = event.key === 'ArrowDown' ? 1 : -1
            setActive(index => results.length ? (index + step + results.length) % results.length : 0)
          } else if (event.key === 'Enter' && open && results[active]) {
            event.preventDefault()
            pick(results[active].coach)
          } else if (event.key === 'Escape' && (open || query)) {
            event.preventDefault() // keep the map open: Esc only dismisses the search first
            if (open) setOpen(false)
            else setQuery('')
          }
        }} />
      {query && <button type="button" className="coach-map-search-clear" aria-label="Limpar busca"
        onClick={() => { setQuery(''); input.current?.focus() }}><X size={15} /></button>}
    </label>
    <div className="coach-map-search-panel">
      <div className="coach-map-search-inner">
        <span className="coach-map-search-heading">{query ? 'Resultados perto de você' : 'Perto de você'}</span>
        <ul id={listId} role="listbox" aria-label="Pessoas próximas">
          {results.map(({ coach, km }, index) => <li key={coach.userId} id={`${listId}-${coach.userId}`} role="option"
            aria-selected={index === active} className={index === active ? 'is-active' : ''}
            onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()}
            onClick={() => pick(coach)}>
            <Avatar person={coach} />
            <span className="coach-map-result-text">
              <strong>{coach.name}</strong>
              <small>{describe(coach)}{coach.city ? ' · ' + coach.city : ''}</small>
            </span>
            <span className="coach-map-distance">{formatDistance(km)}</span>
          </li>)}
        </ul>
        {!results.length && <p className="coach-map-search-empty">
          {query ? `Ninguém encontrado para “${query}”.` : 'Ninguém compartilhou a localização ainda.'}
        </p>}
      </div>
    </div>
  </div>
}

export function CoachMap() {
  const dialog = useRef<HTMLDialogElement>(null)
  const preview = useRef<HTMLElement>(null)
  const fullMap = useRef<maplibregl.Map | null>(null)
  const closing = useRef(false)
  const cameraAnim = useRef<Animation | null>(null)
  const scrollLock = useRef<{ overflow: string; gutter: string } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [zooming, setZooming] = useState(false)
  const [position, setPosition] = useState<Point | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [granted, setGranted] = useState(false)
  const { user } = useAuth()
  const [people, setPeople] = useState<Coach[]>([])
  // null = ainda carregando; consentimento 'location' da LGPD controla aparecer no mapa
  const [sharing, setSharing] = useState<boolean | null>(null)
  const [selectedId, setSelectedId] = useState<string>()
  const coach = people.find(item => item.userId === selectedId) ?? people[0]
  const [viewCoach, setViewCoach] = useState(false)
  const center = position ?? defaultPoint

  const loadPeople = useCallback(() => {
    api<{ people: Coach[] }>('/map/people').then(data => setPeople(data.people), () => {})
  }, [])
  useEffect(() => {
    loadPeople()
    api<{ consents: { purpose: string; granted: boolean }[] }>('/privacy/consents')
      .then(data => setSharing(data.consents.some(c => c.purpose === 'location' && c.granted)), () => setSharing(false))
    // sem GPS liberado, centraliza na última posição salva em vez da cidade padrão
    api<{ location: { lat: number; lon: number } | null }>('/map/location')
      .then(data => { if (data.location) setPosition(p => p ?? [data.location!.lat, data.location!.lon]) }, () => {})
  }, [loadPeople])

  // Só publica a posição quando o usuário consentiu (o servidor também confere)
  const publish = useCallback((point: Point) => {
    api('/map/location', json('PUT', { lat: point[0], lon: point[1] }))
      .then(() => setStatus('Você aparece no mapa (posição aproximada)'), () => {})
  }, [])
  useEffect(() => {
    if (sharing && position) publish(position)
  }, [sharing, position, publish])

  const toggleSharing = async () => {
    const next = !sharing
    try {
      await api('/privacy/consents', json('PUT', { purpose: 'location', granted: next }))
      setSharing(next)
      if (!next) setStatus('Você saiu do mapa. Sua localização foi apagada.')
      else if (!position) setStatus('Ative sua localização para aparecer no mapa.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível atualizar.')
    }
  }

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('Localização indisponível neste navegador.')
      return
    }
    setLoading(true)
    setStatus('Buscando sua região…')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setPosition([Number(coords.latitude.toFixed(2)), Number(coords.longitude.toFixed(2))])
      setViewCoach(false)
      setStatus('Sua localização aproximada')
      setGranted(true)
      setLoading(false)
    }, error => {
      setStatus(error.code === 1 ? 'Localização bloqueada pelo navegador.' : 'Localização indisponível. Tente novamente.')
      setLoading(false)
    }, { maximumAge: 300000, timeout: 12000, enableHighAccuracy: false })
  }, [])

  useEffect(() => {
    let active = true
    let status: PermissionStatus | undefined
    const sync = () => {
      if (!active || !status) return
      setGranted(status.state === 'granted')
      if (status.state === 'granted') locate()
    }
    navigator.permissions?.query({ name: 'geolocation' }).then(permission => {
      status = permission
      permission.addEventListener('change', sync)
      sync()
    }).catch(() => {})
    return () => { active = false; status?.removeEventListener('change', sync) }
  }, [locate])

  // Scroll lock that keeps the scrollbar gutter, so the page doesn't shift while the camera moves
  const lockScroll = () => {
    const html = document.documentElement
    if (scrollLock.current) return
    scrollLock.current = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter }
    if (html.scrollHeight > html.clientHeight) html.style.scrollbarGutter = 'stable'
    html.style.overflow = 'hidden'
  }
  const unlockScroll = () => {
    const saved = scrollLock.current
    if (!saved) return
    document.documentElement.style.overflow = saved.overflow
    document.documentElement.style.scrollbarGutter = saved.gutter
    scrollLock.current = null
  }

  // "Camera" = transform on the whole app: the card's center is moved to the viewport center
  // and scaled until the card covers the whole screen.
  const camera = () => {
    const root = document.getElementById('root')
    const card = preview.current
    if (!root || !card) return null
    const c = card.getBoundingClientRect()
    const r = root.getBoundingClientRect()
    const cx = c.left + c.width / 2
    const cy = c.top + c.height / 2
    const scale = Math.max(innerWidth / c.width, innerHeight / c.height) * 1.06
    root.style.transformOrigin = `${cx - r.left}px ${cy - r.top}px`
    return { root, zoomed: `translate(${innerWidth / 2 - cx}px, ${innerHeight / 2 - cy}px) scale(${scale})` }
  }
  const panels = () => [...(dialog.current?.querySelectorAll<HTMLElement>('.coach-map-toolbar, .coach-map-profile, .coach-map-controls') ?? [])]

  useEffect(() => () => { cameraAnim.current?.cancel(); unlockScroll() }, [])

  const open = () => {
    if (expanded) return
    setViewCoach(false)
    setZooming(true) // fades the card's caption/buttons out of the shot
    setExpanded(true) // mounts the (still closed) dialog so its map loads during the camera move
  }

  useEffect(() => {
    if (!expanded) return
    const motion = motionOk()
    lockScroll()
    const cam = motion ? camera() : null
    if (cam) {
      cameraAnim.current?.cancel()
      cameraAnim.current = cam.root.animate([{ transform: 'none' }, { transform: cam.zoomed }],
        { duration: 1000, easing: cameraEase, fill: 'forwards' })
    }
    const timer = window.setTimeout(() => {
      const el = dialog.current
      if (!el) return
      el.showModal()
      fullMap.current?.resize()
      if (!motion) return
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 480, easing: 'ease-out' }).finished.then(() => {
        // page is fully covered now: drop the transform so nothing stays scaled underneath
        cameraAnim.current?.cancel()
        cameraAnim.current = null
      }, () => {})
      el.querySelector('.coach-map-frame')?.animate(
        [{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 1000, easing: 'cubic-bezier(.16, 1, .3, 1)' })
      panels().forEach((panel, i) => panel.animate(
        [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 520, delay: 260 + i * 90, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'backwards' }))
    }, cam ? 760 : 0)
    return () => window.clearTimeout(timer)
  }, [expanded])

  const close = () => {
    const el = dialog.current
    if (!el || closing.current) return
    closing.current = true
    const cam = motionOk() ? camera() : null
    if (!cam) {
      el.close()
      unlockScroll()
      return
    }
    // camera starts inside the card (hidden behind the map), then pulls back while the map fades out
    cameraAnim.current?.cancel()
    const pullBack = cam.root.animate([{ transform: cam.zoomed }, { transform: 'none' }],
      { duration: 1000, delay: 140, easing: cameraEase, fill: 'backwards' })
    cameraAnim.current = pullBack
    pullBack.finished.then(() => {
      cam.root.style.transformOrigin = ''
      unlockScroll()
    }, () => {})
    panels().forEach(panel => panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }))
    el.querySelector('.coach-map-frame')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }],
      { duration: 420, easing: 'ease-in', fill: 'forwards' })
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-in', fill: 'forwards' })
      .finished.then(() => el.close(), () => el.close())
  }

  const showCoach = useCallback((selected: Coach) => {
    setSelectedId(selected.userId)
    setViewCoach(true)
  }, [])

  const locateButton = granted ? null : <button className="coach-map-locate" onClick={locate} disabled={loading}>
    <LocateFixed size={16} /> Habilitar minha localização?
  </button>
  const shareButton = user?.role === 'admin' || sharing === null ? null
    : <button className="coach-map-locate" onClick={() => void toggleSharing()} aria-pressed={sharing}>
      <MapPin size={16} /> {sharing ? 'Sair do mapa' : 'Aparecer no mapa'}
    </button>

  return <>
    <section ref={preview} className={'coach-map-preview' + (zooming ? ' is-zooming' : '')}>
      <MapView center={center} me={center} />
      <button className="coach-map-open" onClick={open}>
        <span className="coach-map-caption">
          <small>{position ? 'Sua localização aproximada' : defaultCity}</small>
          <strong>Mapa de treinadores e atletas</strong>
        </span>
      </button>
      <div className="coach-map-preview-tools">{locateButton}{shareButton}<span role="status">{status}</span></div>
    </section>
    {expanded && <dialog className="coach-map-screen" ref={dialog} aria-labelledby="coach-map-title"
      onCancel={event => { event.preventDefault(); close() }}
      onClose={() => { closing.current = false; setExpanded(false); setZooming(false) }}>
      <MapView center={viewCoach && coach ? coachPoint(coach) : center} me={center} people={people} interactive
        selectedId={viewCoach ? coach?.userId : undefined} onSelect={showCoach} mapRef={fullMap} />
      <header className="coach-map-toolbar">
        <button aria-label="Voltar para descoberta" onClick={close}><ArrowLeft size={20} /></button>
        <h2 id="coach-map-title">Mapa de treinadores e atletas</h2>
        {locateButton}
        {shareButton}
      </header>
      <div className="coach-map-controls">
        <CoachSearch origin={center} people={people} onPick={showCoach} />
        <div className="coach-map-zoom">
          <button aria-label="Aproximar" onClick={() => fullMap.current?.zoomIn()}><Plus size={18} /></button>
          <button aria-label="Afastar" onClick={() => fullMap.current?.zoomOut()}><Minus size={18} /></button>
        </div>
      </div>
      <section className="coach-map-profile">
        {coach ? <>
          <CoachPicker value={coach} people={people} onChange={showCoach} />
          <p>{roleLabel(coach)}</p>
          <button className="coach-map-city" onClick={() => setViewCoach(true)}>
            <MapPin size={15} />{coach.city || 'Região aproximada'}
          </button>
          <dl>
            <div><dt>Modalidades</dt><dd>{coach.sports.join(', ') || '—'}</dd></div>
            {coach.role === 'coach' && <div><dt>Mensalidade</dt><dd>{coach.price > 0 ? `R$ ${coach.price.toLocaleString('pt-BR')}` : '—'}</dd></div>}
            <div><dt>Distância</dt><dd>{formatDistance(distanceKm(center, coachPoint(coach)))}</dd></div>
          </dl>
        </> : <p>Ninguém compartilhou a localização ainda. Use “Aparecer no mapa” para ser o primeiro.</p>}
        <span className="coach-map-status" role="status">
          {viewCoach && coach ? `Região aproximada · ${formatDistance(distanceKm(center, coachPoint(coach)))} de você` : status || defaultCity}
        </span>
      </section>
    </dialog>}
  </>
}

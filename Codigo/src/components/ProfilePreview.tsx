import { useEffect, useRef, useState, type RefObject } from 'react'
import { motion, useIsPresent, useReducedMotion } from 'motion/react'
import { CopyCheck, X } from 'lucide-react'
import type { AppUser, ProfilePreview as Preview } from '../../shared/contracts'
import { api } from '../services/api'
import './ProfilePreview.css'

export function ProfilePreview({ user, anchorRef, onClose }: {
  user: AppUser
  anchorRef: RefObject<HTMLButtonElement | null>
  onClose: (restoreFocus?: boolean) => void
}) {
  const popover = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const reducedMotion = useReducedMotion()
  const isPresent = useIsPresent()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!isPresent) return
    function outside(event: PointerEvent | FocusEvent) {
      const target = event.target
      if (target instanceof Node && !popover.current?.contains(target) && !anchorRef.current?.contains(target)) {
        onClose(false)
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose(true)
      }
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [anchorRef, isPresent, onClose])

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    api<{ preview: Preview }>('/profiles/me/preview', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setPreview(data.preview) })
      .catch(e => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível carregar seu perfil.')
      })
    return () => controller.abort()
  }, [attempt])

  const name = preview?.name || user.name
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase('pt-BR') || '?'
  const description = preview?.bio.trim() || (user.role === 'coach'
    ? 'Treinador na LinkAtletas.'
    : user.role === 'admin' ? 'Administrador da LinkAtletas.' : 'Atleta na LinkAtletas.')
  const countLabel = preview?.consultedCoaches === 1 ? 'treinador consultado' : 'treinadores consultados'

  function close() {
    onClose(true)
  }

  return (
    <motion.div
      ref={popover}
      id="profile-preview"
      role="dialog"
      aria-modal="false"
      className="profile-preview"
      aria-labelledby="profile-preview-name"
      aria-describedby="profile-preview-bio"
      aria-hidden={!isPresent}
      inert={!isPresent}
      initial={reducedMotion ? false : { opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
    >
      <article className="profile-preview__card">
        <div className="profile-preview__avatar" aria-hidden="true">{initial}</div>
        <button ref={closeButton} type="button" className="profile-preview__close" aria-label="Fechar visualização do perfil" onClick={close}>
          <X size={20} aria-hidden="true" />
        </button>
        <div className="profile-preview__body">
          <h2 id="profile-preview-name">{name}</h2>
          <p id="profile-preview-bio">{description}</p>
          <div className="profile-preview__footer" aria-live="polite">
            {error ? <div className="profile-preview__error">
              <p role="alert">{error}</p>
              <button type="button" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button>
            </div> : preview ? <div className="profile-preview__stat" title={`${preview.consultedCoaches} ${countLabel}`}>
              <CopyCheck size={21} strokeWidth={1.7} aria-hidden="true" />
              <strong>{preview.consultedCoaches}</strong>
              <span>{countLabel}</span>
            </div> : <span role="status" className="profile-preview__loading">Carregando perfil…</span>}
          </div>
        </div>
      </article>
    </motion.div>
  )
}

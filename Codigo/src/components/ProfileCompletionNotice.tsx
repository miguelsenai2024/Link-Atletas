import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserRoundPen } from 'lucide-react'
import { profileMissing, type Profile } from '../../shared/contracts'
import { api } from '../services/api'

/** Aviso para completar o perfil. Recebe o perfil já carregado ou busca o próprio. */
export function ProfileCompletionNotice({
  profile: given,
  profileHref,
}: {
  profile?: Profile | null
  profileHref?: string
}) {
  const [fetched, setFetched] = useState<Profile | null>(null)
  useEffect(() => {
    if (given !== undefined) return
    const controller = new AbortController()
    api<{ profile: Profile }>('/profiles/me', { signal: controller.signal })
      .then((d) => setFetched(d.profile))
      .catch(() => {}) // aviso é opcional: sem perfil, nada a mostrar
    return () => controller.abort()
  }, [given])
  const profile = given === undefined ? fetched : given
  if (!profile || profile.role === 'admin') return null
  const missing = profileMissing(profile)
  const noPhoto = !profile.photoUpdatedAt
  if (!missing.length && !noPhoto) return null
  return (
    <div className="live-success pf-complete-notice" role="status">
      <UserRoundPen size={18} aria-hidden="true" />{' '}
      {missing.length > 0 && (
        <>
          <strong>Complete seu perfil:</strong> falta informar{' '}
          {missing.join(', ').replace(/, ([^,]*)$/, ' e $1')}. Esses dados
          ajudam o treinador a montar treinos sob medida.{' '}
        </>
      )}
      {noPhoto && (
        <>
          A foto é opcional, mas seria legal ter uma: ela aparece no seu
          perfil e no mapa.{' '}
        </>
      )}
      {profileHref && (
        <Link className="live-link" to={profileHref}>
          Ir para o perfil
        </Link>
      )}
    </div>
  )
}

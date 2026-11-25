import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, PlayCircle, Plus, Save, Send, Trash2 } from 'lucide-react'
import type {
  Contract,
  ExerciseBlock,
  MetricType,
  Workout,
  WorkoutInput,
} from '../../../shared/contracts'
import { SPORTS } from '../../../shared/contracts'
import { api, json } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { MediaPanel } from './Expansion'
import {
  Badge,
  day,
  Empty,
  message,
  Notice,
  PageTitle,
  State,
  useRemote,
} from './common'

const blankBlock = (): ExerciseBlock => ({ name: '', instructions: '' })
function blankWorkout(contractId = ''): WorkoutInput {
  return {
    contractId,
    title: '',
    sport: 'Corrida',
    scheduledDate: new Date().toLocaleDateString('en-CA'),
    instructions: '',
    status: 'draft',
    blocks: [blankBlock()],
  }
}
export function CoachWorkoutsPage() {
  const remote = useRemote<{ workouts: Workout[] }>('/workouts')
  const contracts = useRemote<{ contracts: Contract[] }>('/contracts')
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<WorkoutInput | null>(
    params.get('atleta') ? blankWorkout(params.get('atleta')!) : null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [view, setView] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'executed'>('all')
  const active =
    contracts.data?.contracts.filter((c) => c.status === 'active') || []
  const allWorkouts = remote.data?.workouts || []
  const publishedCount = allWorkouts.filter((w) => w.status === 'published').length
  const executedCount = allWorkouts.filter((w) => !!w.execution).length
  const feedbackPct = publishedCount ? Math.round((executedCount / publishedCount) * 100) : 0
  const visibleWorkouts = allWorkouts.filter((w) => {
    if (filter === 'published') return w.status === 'published'
    if (filter === 'draft') return w.status === 'draft'
    if (filter === 'executed') return !!w.execution
    return true
  })
  function edit(w: Workout) {
    setEditing(w.id)
    setForm({
      contractId: w.contractId,
      title: w.title,
      sport: w.sport,
      scheduledDate: w.scheduledDate.slice(0, 10),
      instructions: w.instructions,
      status: w.status,
      blocks: w.blocks.map((b) => ({ ...b })),
    })
    setSuccess('')
    setError('')
  }
  function set<K extends keyof WorkoutInput>(key: K, value: WorkoutInput[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }
  function setBlock<K extends keyof ExerciseBlock>(
    index: number,
    key: K,
    value: ExerciseBlock[K],
  ) {
    if (form)
      set(
        'blocks',
        form.blocks.map((b, i) => (i === index ? { ...b, [key]: value } : b)),
      )
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form) return
    const submitter = (e.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null
    const status = submitter?.value === 'published' ? 'published' : 'draft'
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await api(
        editing ? '/workouts/' + editing : '/workouts',
        json(editing ? 'PUT' : 'POST', { ...form, status }),
      )
      setSuccess(
        status === 'published'
          ? 'Treino publicado. O atleta já pode acessá-lo.'
          : 'Rascunho salvo. Publique quando estiver pronto.',
      )
      setForm(null)
      setEditing(null)
      await remote.reload()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="exp-coach-workouts-page">
      <PageTitle
        title="Planeje o próximo passo"
        description="Crie treinos para seus atletas e acompanhe o retorno de cada execução."
        action={
          <button
            className="button button--dark"
            disabled={contracts.loading || !active.length}
            onClick={() => {
              setEditing(null)
              setForm(blankWorkout(active[0]?.id))
              setError('')
              setSuccess('')
            }}
          >
            <Plus size={18} />
            Novo treino
          </button>
        }
      />
      <Notice error={error} success={success} />
      <State {...contracts} retry={contracts.reload} />
      <State {...remote} retry={remote.reload} />
      <div className="exp-coach-workouts">
        <div className="exp-coach-workouts__main">
          {contracts.data && !active.length && (
            <Empty>
              Você precisa aceitar uma solicitação de contratação para prescrever
              treinos.
            </Empty>
          )}
          {form && (
            <form
              className="live-panel live-form live-workout-editor"
              onSubmit={save}
            >
              <div className="live-panel-heading">
                <div>
                  <h3>{editing ? 'Editar treino' : 'Novo treino'}</h3>
                  <p>Adicione instruções claras e os blocos de exercícios.</p>
                </div>
                <button
                  type="button"
                  className="button button--outline"
                  disabled={busy}
                  onClick={() => {
                    setForm(null)
                    setEditing(null)
                    setError('')
                  }}
                >
                  Cancelar edição
                </button>
              </div>
              <div className="live-grid-2">
                <label>
                  Título do treino
                  <input
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    minLength={3}
                    maxLength={150}
                    required
                  />
                </label>
                <label>
                  Atleta
                  <select
                    value={form.contractId}
                    onChange={(e) => set('contractId', e.target.value)}
                    disabled={!!editing}
                    required
                  >
                    <option value="">Selecione um atleta</option>
                    {active.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.athleteName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Modalidade
                  <select
                    value={form.sport}
                    onChange={(e) => set('sport', e.target.value)}
                  >
                    {SPORTS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Data do treino
                  <input
                    type="date"
                    value={form.scheduledDate.slice(0, 10)}
                    onChange={(e) => set('scheduledDate', e.target.value)}
                    required
                  />
                </label>
              </div>
              <label>
                Orientações gerais
                <textarea
                  rows={3}
                  value={form.instructions}
                  onChange={(e) => set('instructions', e.target.value)}
                  maxLength={3000}
                />
              </label>
              {form.blocks.map((block, index) => (
                <fieldset className="live-block-editor" key={index}>
                  <legend>Bloco {index + 1}</legend>
                  <div className="live-grid-2">
                    <label>
                      Nome do exercício
                      <input
                        minLength={2}
                        value={block.name}
                        onChange={(e) => setBlock(index, 'name', e.target.value)}
                        required
                        maxLength={150}
                      />
                    </label>
                    <label>
                      Vídeo de referência (URL)
                      <input
                        type="url"
                        value={block.videoUrl || ''}
                        placeholder="https://…"
                        pattern="https://.*"
                        onChange={(e) =>
                          setBlock(index, 'videoUrl', e.target.value || undefined)
                        }
                        maxLength={2000}
                      />
                    </label>
                  </div>
                  <label>
                    Instruções do exercício
                    <textarea
                      value={block.instructions}
                      onChange={(e) =>
                        setBlock(index, 'instructions', e.target.value)
                      }
                      maxLength={2000}
                      rows={2}
                    />
                  </label>
                  <div className="live-grid-3">
                    {(
                      [
                        { key: 'sets', label: 'Séries', step: 1, max: 100 },
                        {
                          key: 'repetitions',
                          label: 'Repetições',
                          step: 1,
                          max: 10000,
                        },
                        {
                          key: 'loadKg',
                          label: 'Carga (kg)',
                          step: 0.1,
                          max: 1000,
                        },
                        {
                          key: 'durationMinutes',
                          label: 'Duração (min)',
                          step: 0.1,
                          max: 1440,
                        },
                        {
                          key: 'distanceKm',
                          label: 'Distância (km)',
                          step: 0.01,
                          max: 1000,
                        },
                      ] as const
                    ).map(({ key, label, step, max }) => (
                      <label key={key}>
                        {label}
                        <input
                          type="number"
                          min={key === 'sets' || key === 'repetitions' ? 1 : 0}
                          max={max}
                          step={step}
                          value={block[key] ?? ''}
                          onChange={(e) =>
                            setBlock(
                              index,
                              key,
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                  {form.blocks.length > 1 && (
                    <button
                      className="button button--outline"
                      type="button"
                      onClick={() =>
                        set(
                          'blocks',
                          form.blocks.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 size={15} />
                      Remover bloco {index + 1}
                    </button>
                  )}
                </fieldset>
              ))}
              <button
                type="button"
                className="button button--outline"
                disabled={form.blocks.length >= 30}
                onClick={() => set('blocks', [...form.blocks, blankBlock()])}
              >
                <Plus size={16} />
                Adicionar bloco
              </button>
              <div className="live-actions">
                <button
                  className="button button--outline"
                  value="draft"
                  disabled={busy}
                >
                  <Save size={17} />
                  {busy ? 'Salvando…' : 'Salvar rascunho'}
                </button>
                <button
                  className="button button--dark"
                  value="published"
                  disabled={busy}
                >
                  <Send size={17} />
                  {busy ? 'Salvando…' : 'Publicar treino'}
                </button>
              </div>
            </form>
          )}
          {allWorkouts.length > 1 && (
            <div className="exp-coach-filters" role="group" aria-label="Filtrar treinos">
              {(
                [
                  ['all', `Todos (${allWorkouts.length})`],
                  ['published', `Publicados (${publishedCount})`],
                  ['draft', `Rascunhos (${allWorkouts.length - publishedCount})`],
                  ['executed', `Com retorno (${executedCount})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={'exp-coach-filter' + (filter === key ? ' is-active' : '')}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="live-stack">
            {remote.data && !allWorkouts.length && !form && (
              <Empty>
                Nenhum treino prescrito. Crie um treino e salve como rascunho ou
                publique para o atleta.
              </Empty>
            )}
            {remote.data && allWorkouts.length > 0 && !visibleWorkouts.length && (
              <Empty>Nenhum treino encontrado com esse filtro.</Empty>
            )}
            {visibleWorkouts.map((w) => {
              const stats = workoutSummaryStats(w)
              return (
                <article className="live-panel exp-coach-workout-card" key={w.id}>
                  <div className="exp-coach-workout-card__head">
                    <div>
                      <span className="exp-workout-hero__eyebrow">
                        {w.sport} · {day(w.scheduledDate)}
                      </span>
                      <h3>{w.title}</h3>
                      <p className="exp-coach-workout-card__athlete">{w.athleteName}</p>
                    </div>
                    <div className="exp-coach-workout-card__right">
                      <dl className="exp-workout-hero__stats exp-workout-hero__stats--compact">
                        {stats.map((s) => (
                          <div key={s.unit}>
                            <dt>{s.unit}</dt>
                            <dd>{s.value}</dd>
                          </div>
                        ))}
                      </dl>
                      <Badge status={w.status} />
                    </div>
                  </div>
                  <div className="live-actions">
                    <button
                      className="button button--outline"
                      onClick={() => setView(view === w.id ? null : w.id)}
                    >
                      {view === w.id ? 'Ocultar detalhes' : 'Ver detalhes e execução'}
                    </button>
                    {!w.execution && (
                      <button className="button button--dark" onClick={() => edit(w)}>
                        Editar treino
                      </button>
                    )}
                    {w.execution && (
                      <span className="live-badge live-badge--approved">
                        Feedback registrado
                      </span>
                    )}
                  </div>
                  {view === w.id && <WorkoutDetails workout={w} />}
                </article>
              )
            })}
          </div>
        </div>

        <aside className="live-panel exp-coach-overview" aria-label="Panorama de prescrição">
          <div className="exp-coach-overview__head">
            <span className="exp-workout-hero__eyebrow">Panorama de prescrição</span>
            <h3>Acompanhamento dos alunos</h3>
          </div>
          <dl className="exp-coach-overview__stats">
            <div>
              <dt>Treinos</dt>
              <dd>{allWorkouts.length}</dd>
            </div>
            <div>
              <dt>Publicados</dt>
              <dd>{publishedCount}</dd>
            </div>
            <div>
              <dt>Com retorno</dt>
              <dd className={executedCount > 0 ? 'is-accent' : undefined}>{executedCount}</dd>
            </div>
          </dl>
          {publishedCount > 0 && (
            <div className="exp-workout-progress">
              <div className="exp-workout-progress__label">
                <span>Retornos registrados</span>
                <strong>{executedCount}/{publishedCount}</strong>
              </div>
              <div
                className="exp-workout-progress__bar"
                role="progressbar"
                aria-label="Retornos registrados"
                aria-valuemin={0}
                aria-valuemax={publishedCount}
                aria-valuenow={executedCount}
              >
                <span style={{ width: feedbackPct + '%' }} />
              </div>
            </div>
          )}
          <div className="exp-coach-overview__roster">
            <div className="exp-coach-overview__roster-head">
              <span>Atletas ativos</span>
              <strong>{active.length}</strong>
            </div>
            {active.length > 0 ? (
              <ul className="exp-coach-roster">
                {active.map((c) => {
                  const athleteWorkouts = allWorkouts.filter((w) => w.contractId === c.id)
                  const latest = athleteWorkouts[0]
                  return (
                    <li key={c.id}>
                      <span className="exp-coach-roster__avatar" aria-hidden="true">
                        {initials(c.athleteName)}
                      </span>
                      <div className="exp-coach-roster__info">
                        <strong>{c.athleteName}</strong>
                        <small>
                          {athleteWorkouts.length === 0
                            ? 'Nenhum treino ainda'
                            : `${athleteWorkouts.length} ${athleteWorkouts.length === 1 ? 'treino' : 'treinos'} · último ${day(latest.scheduledDate)}`}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="exp-coach-roster__btn"
                        disabled={busy}
                        onClick={() => {
                          setEditing(null)
                          setForm(blankWorkout(c.id))
                          setError('')
                          setSuccess('')
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        <Plus size={13} aria-hidden="true" /> Prescrever
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="exp-coach-overview__empty">
                Assim que você aceitar um vínculo, seus atletas aparecem aqui para prescrição rápida.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
function WorkoutDetails({ workout: w }: { workout: Workout }) {
  const { user } = useAuth()
  const catalog = useRemote<{ metrics: MetricType[] }>(
    '/metrics?sport=' + encodeURIComponent(w.sport),
  )
  return (
    <div className="live-workout-detail">
      <p>{w.instructions || 'Siga as orientações de cada bloco.'}</p>
      {w.blocks.map((b, i) => (
        <div className="live-exercise" key={i}>
          <span>{String(i + 1).padStart(2, '0')}</span>
          <div>
            <strong>{b.name}</strong>
            <p>{b.instructions}</p>
            <BlockMeta block={b} />
            {b.videoUrl && /^https?:\/\//i.test(b.videoUrl) && (
              <a
                href={b.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="live-link"
              >
                Ver vídeo de referência ↗
              </a>
            )}
          </div>
        </div>
      ))}
      {w.execution && (
        <section className="live-execution-summary">
          <h4>Execução do atleta</h4>
          <p>
            {w.execution.completedBlocks.length} de {w.blocks.length} blocos
            realizados · Esforço percebido: {w.execution.effort}/10
          </p>
          <p>{w.execution.notes || 'Sem observações.'}</p>
          <div className="live-tags">
            {Object.entries(w.execution.metrics).map(([key, value]) => {
              const metric = catalog.data?.metrics.find((m) => m.key === key)
              return (
                <span key={key}>
                  {metric?.label || key}: {value}
                  {metric ? ' ' + metric.unit : ''}
                </span>
              )
            })}
          </div>
          <small>
            Atualizado em{' '}
            {new Date(w.execution.updatedAt).toLocaleString('pt-BR')}
          </small>
        </section>
      )}
      <MediaPanel
        resourceId={w.id}
        purpose={user?.role === 'coach' ? 'instruction' : 'performance'}
      />
    </div>
  )
}
function BlockMeta({ block: b }: { block: ExerciseBlock }) {
  return (
    <div className="live-tags">
      {b.sets != null && <span>{b.sets} séries</span>}
      {b.repetitions != null && <span>{b.repetitions} repetições</span>}
      {b.loadKg != null && <span>{b.loadKg} kg</span>}
      {b.durationMinutes != null && <span>{b.durationMinutes} min</span>}
      {b.distanceKm != null && <span>{b.distanceKm} km</span>}
    </div>
  )
}
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
function shortDate(value: string) {
  const [, m, d] = value.slice(0, 10).split('-')
  return { day: d, month: MONTHS[Number(m) - 1] || '' }
}
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  )
}

export function AthleteWorkoutsPage() {
  const remote = useRemote<{ workouts: Workout[] }>('/workouts')
  const [selected, setSelected] = useState('')
  const [success, setSuccess] = useState('')
  const w =
    remote.data?.workouts.find((w) => w.id === selected) ||
    remote.data?.workouts[0]
  const [completed, setCompleted] = useState<number[]>([])
  // sincroniza o check-in com o treino ativo (e com o que já foi registrado)
  useEffect(() => {
    setCompleted(w?.execution?.completedBlocks || [])
  }, [w?.id, w?.execution?.updatedAt])
  function toggle(i: number) {
    setCompleted((c) => (c.includes(i) ? c.filter((n) => n !== i) : [...c, i]))
  }
  return (
    <>
      <PageTitle
        title="Seu treino, sua evolução"
        description="Confira as orientações, realize os exercícios e conte ao treinador como foi."
      />
      <State {...remote} retry={remote.reload} />
      <Notice success={success} />
      {remote.data && !remote.data.workouts.length && (
        <Empty>
          Você ainda não possui treinos publicados. Aguarde a prescrição do seu
          treinador.
        </Empty>
      )}
      {!!remote.data?.workouts.length && w && (
        <div className="exp-workout">
          {remote.data.workouts.length > 1 && (
            <WorkoutSessionStrip
              workouts={remote.data.workouts}
              activeId={w.id}
              onSelect={(id) => {
                setSelected(id)
                setSuccess('')
              }}
            />
          )}
          <div className="exp-workout-layout">
            <section className="live-panel exp-workout-sheet" aria-label="Ficha do treino">
              <WorkoutHeroSummary workout={w} />
              {w.blocks.length > 0 && (
                <WorkoutTimeline workout={w} completed={completed} onToggle={toggle} />
              )}
              <div className="exp-workout-media">
                <MediaPanel resourceId={w.id} purpose="performance" collapsible />
              </div>
            </section>
            <ExecutionForm
              key={w.id}
              workout={w}
              completed={completed}
              onSave={async () => {
                await remote.reload()
                setSuccess('Execução registrada com sucesso.')
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}

function WorkoutSessionStrip({
  workouts,
  activeId,
  onSelect,
}: {
  workouts: Workout[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="exp-workout-strip" role="group" aria-label="Treino selecionado">
      {workouts.map((item) => {
        const { day: d, month } = shortDate(item.scheduledDate)
        const done = !!item.execution
        const active = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            data-workout-id={item.id}
            className={
              'exp-workout-strip__item' +
              (active ? ' is-active' : '') +
              (done ? ' is-done' : '')
            }
            aria-pressed={active}
            aria-label={`${day(item.scheduledDate)} · ${item.sport} · ${item.title}${done ? ' · Feedback registrado' : ' · Pendente'}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="exp-workout-strip__date">
              <strong>{d}</strong>
              <small>{month}</small>
            </span>
            <span className="exp-workout-strip__text">
              <small>{item.sport}</small>
              <span>{item.title}</span>
            </span>
            <span className="exp-workout-strip__status" aria-hidden="true">
              {done ? <Check size={13} strokeWidth={3} /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function workoutSummaryStats(w: Workout) {
  const sum = (k: 'durationMinutes' | 'distanceKm' | 'sets') =>
    w.blocks.reduce((t, b) => t + (b[k] ?? 0), 0)
  const loads = w.blocks.map((b) => b.loadKg).filter((n): n is number => n != null)
  const stats: { value: string; unit: string }[] = []
  const minutes = sum('durationMinutes')
  const km = sum('distanceKm')
  const sets = sum('sets')
  if (minutes) stats.push({ value: fmt(minutes), unit: 'min' })
  if (km) stats.push({ value: fmt(km), unit: 'km' })
  if (sets) stats.push({ value: fmt(sets), unit: 'séries' })
  if (loads.length) stats.push({ value: fmt(Math.max(...loads)), unit: 'kg máx' })
  stats.push({ value: String(w.blocks.length), unit: w.blocks.length === 1 ? 'etapa' : 'etapas' })
  return stats
}

function WorkoutHeroSummary({ workout: w }: { workout: Workout }) {
  const stats = workoutSummaryStats(w)
  return (
    <header className="exp-workout-hero">
      <div className="exp-workout-hero__meta">
        <span className="exp-workout-hero__eyebrow">
          {w.sport} · {day(w.scheduledDate)}
        </span>
        <Badge status={w.execution ? 'completed' : w.status} />
      </div>
      <div className="exp-workout-hero__head">
        <h3>{w.title}</h3>
        <dl className="exp-workout-hero__stats" aria-label="Resumo do volume do treino">
          {stats.map((s) => (
            <div key={s.unit}>
              <dt>{s.unit}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <blockquote className="exp-coach-brief">
        <small className="exp-coach-brief__byline">
          <span className="exp-coach-brief__initials" aria-hidden="true">
            {initials(w.coachName)}
          </span>
          <span aria-hidden="true">·</span>
          <span>Orientação de {w.coachName}</span>
        </small>
        <p>{w.instructions || 'Siga as orientações de cada bloco.'}</p>
      </blockquote>
    </header>
  )
}

function blockSpecs(b: ExerciseBlock): { value: string; unit: string }[] {
  const items: { value: string; unit: string }[] = []
  if (b.sets != null) {
    if (b.repetitions != null) {
      items.push({ value: `${b.sets}×${b.repetitions}`, unit: 'séries' })
    } else {
      items.push({ value: String(b.sets), unit: b.sets === 1 ? 'série' : 'séries' })
    }
  } else if (b.repetitions != null) {
    items.push({ value: String(b.repetitions), unit: 'reps' })
  }
  if (b.loadKg != null) items.push({ value: fmt(b.loadKg), unit: 'kg' })
  if (b.distanceKm != null) items.push({ value: fmt(b.distanceKm), unit: 'km' })
  if (b.durationMinutes != null) items.push({ value: fmt(b.durationMinutes), unit: 'min' })
  return items
}

function WorkoutTimeline({
  workout: w,
  completed,
  onToggle,
}: {
  workout: Workout
  completed: number[]
  onToggle: (i: number) => void
}) {
  return (
    <ol className="exp-workout-timeline" aria-label="Blocos do treino">
      {w.blocks.map((b, i) => {
        const done = completed.includes(i)
        const specs = blockSpecs(b)
        return (
          <li key={i} className={done ? 'is-done' : undefined}>
            <span className="exp-workout-timeline__marker" aria-hidden="true">
              {done ? <Check size={14} strokeWidth={3} /> : String(i + 1).padStart(2, '0')}
            </span>
            <div className="exp-workout-timeline__body">
              <div className="exp-workout-timeline__row">
                <div className="exp-workout-timeline__info">
                  <strong className="exp-workout-timeline__name">{b.name}</strong>
                  {b.instructions && <p>{b.instructions}</p>}
                  {b.videoUrl && /^https?:\/\//i.test(b.videoUrl) && (
                    <a
                      href={b.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="exp-workout-video"
                    >
                      <PlayCircle size={14} aria-hidden="true" /> Vídeo de demonstração ↗
                    </a>
                  )}
                </div>
                <div className="exp-workout-timeline__aside">
                  {specs.length > 0 && (
                    <div className="exp-workout-specs">
                      {specs.map((spec) => (
                        <span key={`${spec.value}-${spec.unit}`} className="exp-workout-specs__item">
                          <strong>{spec.value}</strong>
                          <span>{spec.unit}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <BlockCheck
                    done={done}
                    label={`${i + 1}. ${b.name}`}
                    onToggle={() => onToggle(i)}
                  />
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ✓ some → círculo se desenha → ✓ dentro do círculo → verde preenche o botão.
// A animação só roda no clique (is-anim), não em blocos que já carregam marcados.
function BlockCheck({
  done,
  label,
  onToggle,
}: {
  done: boolean
  label: string
  onToggle: () => void
}) {
  const [anim, setAnim] = useState(false)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      className={'exp-workout-check' + (anim ? ' is-anim' : '')}
      onClick={() => {
        setAnim(!done)
        onToggle()
      }}
      onAnimationEnd={(e) => {
        // só o fim da sequência inteira (o ::before também dispara no botão)
        if (e.target === e.currentTarget && e.animationName === 'exp-check-color') setAnim(false)
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="exp-workout-check__icon">
        <path className="exp-workout-check__tick" d="M20 6 9 17l-5-5" />
        <circle className="exp-workout-check__ring" cx="12" cy="12" r="9" />
        <path className="exp-workout-check__mark" d="M8 12.5l2.8 2.8L16.2 9.6" />
      </svg>
      <span>{done ? 'Feito' : 'Marcar'}</span>
    </button>
  )
}

const RPE_LEGEND:[number, string, string][] = [
  [2, 'Muito leve', 'Recuperação'],
  [4, 'Leve', 'Confortável / Aeróbico'],
  [6, 'Moderado', 'Ritmo controlado'],
  [8, 'Intenso', 'Desafiador / Limiar'],
  [10, 'Máximo', 'Exaustivo'],
]
function rpeInfo(n: number) {
  return RPE_LEGEND.find(([max]) => n <= max)!
}
const RPE_COLORS = [
  '#4fd1a5',
  '#6bd99c',
  '#8ee28c',
  '#b4eb78',
  '#d7f266',
  '#e7df5c',
  '#f2c45a',
  '#f59f56',
  '#f27c5c',
  '#ef6b61',
]
function RpeScale({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [, label, hint] = rpeInfo(value)
  const activeColor = RPE_COLORS[value - 1] || 'var(--lime)'
  function onKey(e: React.KeyboardEvent) {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = Math.min(10, Math.max(1, value + delta))
    onChange(next)
    const group = e.currentTarget as HTMLElement
    group.querySelector<HTMLButtonElement>(`[data-rpe="${next}"]`)?.focus()
  }
  return (
    <div className="exp-rpe" style={{ '--rpe-active': activeColor } as React.CSSProperties}>
      <span className="exp-rpe__label" id="rpe-label">
        Esforço percebido (PSE)
      </span>
      <div className="exp-rpe-scale" role="radiogroup" aria-labelledby="rpe-label" onKeyDown={onKey}>
        {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => {
          const filled = n <= value
          const current = n === value
          return (
            <button
              key={n}
              type="button"
              role="radio"
              data-rpe={n}
              data-filled={filled ? 'true' : undefined}
              aria-checked={current}
              aria-label={`${n} · ${rpeInfo(n)[1]}`}
              tabIndex={current ? 0 : -1}
              style={{ '--rpe': RPE_COLORS[n - 1] } as React.CSSProperties}
              className={
                'exp-rpe-scale__item' +
                (filled ? ' is-filled' : '') +
                (current ? ' is-current' : '')
              }
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          )
        })}
      </div>
      <p className="exp-rpe__legend" aria-live="polite">
        <strong>{value}</strong> · {label} <span>({hint})</span>
      </p>
    </div>
  )
}

function ExecutionForm({
  workout: w,
  completed,
  onSave,
}: {
  workout: Workout
  completed: number[]
  onSave: () => Promise<void>
}) {
  const metrics = useRemote<{ metrics: MetricType[] }>(
    '/metrics?sport=' + encodeURIComponent(w.sport),
  )
  const [effort, setEffort] = useState(w.execution?.effort || 5)
  const [notes, setNotes] = useState(w.execution?.notes || '')
  const [values, setValues] = useState<Record<string, number>>(
    w.execution?.metrics || {},
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(
        '/workouts/' + w.id + '/execution',
        json('PUT', {
          completedBlocks: completed,
          effort,
          notes,
          metrics: values,
        }),
      )
      await onSave()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  const total = w.blocks.length
  const pct = total ? Math.round((completed.length / total) * 100) : 0
  return (
    <form className="live-panel live-form exp-workout-diary" onSubmit={save}>
      <div className="exp-workout-diary__head">
        <span className="exp-workout-hero__eyebrow">Diário de execução</span>
        <h3>Como foi seu treino?</h3>
        {w.execution && (
          <p className="exp-workout-diary__stamp">
            <Check size={14} strokeWidth={3} aria-hidden="true" /> Última
            atualização em {new Date(w.execution.updatedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
      <div className="exp-workout-progress">
        <div className="exp-workout-progress__label">
          <span>Blocos realizados</span>
          <strong>
            {completed.length}/{total}
          </strong>
        </div>
        <div
          className="exp-workout-progress__bar"
          role="progressbar"
          aria-label="Blocos realizados"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed.length}
        >
          <span style={{ width: pct + '%' }} />
        </div>
        <small>Marque os blocos na ficha ao lado. Execução parcial também vale.</small>
      </div>
      <RpeScale value={effort} onChange={setEffort} />
      <State {...metrics} retry={metrics.reload} />
      {!!metrics.data?.metrics.length && (
        <fieldset className="exp-workout-metrics">
          <legend>Métricas da modalidade</legend>
          {metrics.data.metrics.map((m) => (
            <label key={m.key}>
              <span>{m.label}</span>
              <span className="exp-workout-metrics__field">
                <input
                  type="number"
                  aria-label={`${m.label} (${m.unit})`}
                  min={m.min}
                  max={m.max}
                  step={m.key === 'repetitions' ? 1 : 'any'}
                  value={values[m.key] ?? ''}
                  onChange={(e) => {
                    const next = { ...values }
                    if (e.target.value === '') delete next[m.key]
                    else next[m.key] = Number(e.target.value)
                    setValues(next)
                  }}
                />
                <em aria-hidden="true">{m.unit}</em>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <label>
        Observações do treino
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={3000}
          placeholder="Como você se sentiu? Houve alguma dificuldade?"
        />
      </label>
      <Notice error={error} />
      <button
        className="button button--dark"
        disabled={busy || metrics.loading || !!metrics.error}
      >
        <Save size={17} />
        {busy ? 'Salvando…' : w.execution ? 'Atualizar execução' : 'Salvar execução'}
      </button>
    </form>
  )
}

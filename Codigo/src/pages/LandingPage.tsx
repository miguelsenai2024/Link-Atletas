import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import './landing.css'
import { MotionAccordion } from '../components/MotionAccordion'

const sportPanels = [
  { label: 'Corrida', title: 'Mais fôlego.', sport: 'Corrida', image: 'corrida.jpg', alt: 'Corrida em pista', height: 1800 },
  { label: 'Seu ritmo', message: <span>Seu corpo.<br />Sua história.<br /><i>Seu ritmo.</i></span>, note: <img src="/landing/logo.svg" width="42" height="42" alt="" /> },
  { label: 'Força', title: 'Mais força.', sport: 'Musculação', image: 'forca.jpg', alt: 'Treino de força na academia', height: 800 },
  { label: 'Novos caminhos', title: 'Mais caminhos.', sport: 'Ciclismo', image: 'ciclismo.jpg', alt: 'Ciclismo em uma estrada na natureza', height: 675 },
  { label: 'Próximo nível', message: <span>O próximo<br />nível começa<br /><i>com você.</i></span>, note: <small>Vai com tudo.</small> },
]

const goalCopy: Record<string, string> = {
  'começar': 'Começar com orientação e um plano que respeite seu ponto de partida.',
  'constância': 'Construir uma rotina possível, com acompanhamento ao longo do caminho.',
  performance: 'Ajustar seus treinos aos seus objetivos e acompanhar a evolução com seu treinador.',
}

const landingFaqs = [
  {
    "question": "Preciso ser atleta profissional?",
    "answer": "Não. A LinkAtletas atende desde quem está começando até quem busca melhorar a performance. Seu perfil ajuda a encontrar o acompanhamento adequado ao seu momento."
  },
  {
    "question": "Como encontro o treinador certo?",
    "answer": "Você informa modalidade, nível, objetivo, orçamento e disponibilidade. A plataforma usa esses critérios para mostrar profissionais compatíveis, com perfis e avaliações para você comparar."
  },
  {
    "question": "Como os profissionais são verificados?",
    "answer": "O cadastro de treinador exige CREF e documentação. A equipe administrativa confere os dados antes de liberar o perfil na busca."
  },
  {
    "question": "Posso treinar com acompanhamento online?",
    "answer": "Sim. Você pode buscar atendimento online, presencial ou híbrido, conforme a disponibilidade de cada profissional."
  },
  {
    "question": "Como funciona o acompanhamento?",
    "answer": "Seu treinador publica o plano na plataforma. Você registra os treinos, compartilha feedbacks e pode enviar vídeos de execução para receber orientações."
  },
  {
    "question": "Quem pode ver meus vídeos e dados?",
    "answer": "Os arquivos de acompanhamento são privados e restritos às pessoas do vínculo. Dados de performance e saúde exigem consentimento específico, gerenciado na área de Privacidade."
  }
]

const heroSports = [
  { name: 'Corrida', image: 'hero-corrida-campo.webp', position: '72% 50%' },
  { name: 'Força', image: 'forca.jpg', position: 'center 40%' },
  { name: 'Novos caminhos', image: 'ciclismo.jpg', position: 'center 40%' },
]

export function LandingPage() {
  const heroSport = heroSports[0]
  const [activeSportPanel, setActiveSportPanel] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [answers, setAnswers] = useState({ sport: '', goal: '', format: '' })
  const [result, setResult] = useState<typeof answers | null>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const resultElement = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    const root = document.documentElement
    const previousPadding = root.style.scrollPaddingTop
    const previousBehavior = root.style.scrollBehavior
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateScroll = () => { root.style.scrollBehavior = reducedMotion.matches ? 'auto' : 'smooth' }
    root.style.scrollPaddingTop = '30px'
    updateScroll()
    reducedMotion.addEventListener('change', updateScroll)
    return () => {
      root.style.scrollPaddingTop = previousPadding
      root.style.scrollBehavior = previousBehavior
      reducedMotion.removeEventListener('change', updateScroll)
    }
  }, [])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }
    const desktop = window.matchMedia('(min-width: 761px)')
    const closeOnResize = () => setMenuOpen(false)
    document.addEventListener('keydown', closeOnEscape)
    desktop.addEventListener('change', closeOnResize)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      desktop.removeEventListener('change', closeOnResize)
    }
  }, [menuOpen])

  useEffect(() => {
    if (result) resultElement.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [result])

  function selectSport(event: MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-sport]') : null
    const sport = target?.dataset.sport
    if (sport) {
      setAnswers(current => ({ ...current, sport }))
      setResult(null)
    }
  }

  function submitMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (answers.sport && answers.goal && answers.format) setResult({ ...answers })
  }

  return <div className="editorial-landing" onClick={selectSport}>
<a className="lp-skip-link" href="#conteudo">Pular para o conteúdo</a>
  <header className="lp-site-header lp-wrap">
    <a className="lp-brand" href="#inicio" aria-label="LinkAtletas — início"><img src="/landing/logo.svg" alt="" width="32" height="32" /><span>LinkAtletas</span></a>
    <nav aria-label="Navegação principal" id="navigation" className={menuOpen ? 'lp-is-open' : ''} onClick={() => setMenuOpen(false)}>
      <a href="#como-funciona">Como funciona</a>
      <a href="#treinadores">Para treinadores</a>
      <a href="#perguntas">Perguntas</a>
      <Link className="lp-nav-login" to="/login">Entrar <span aria-hidden="true">↗</span></Link>
    </nav>
    <button className="lp-menu-toggle" type="button" ref={menuButton} onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="navigation" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}><span></span><span></span></button>
  </header>

  <main id="conteudo">
    <section className="lp-hero" id="inicio" aria-labelledby="hero-title">
      <img className="lp-hero-photo" src={'/landing/' + heroSport.image} alt="" fetchPriority="high" style={{ objectPosition: heroSport.position }} />
      <div className="lp-hero-copy">
        <h1 id="hero-title">Seu ritmo. Sua meta.<br />Seu próximo <em>match.</em></h1>
        <p>Gente que quer evoluir. Gente que sabe orientar.<br />A gente conecta.</p>
        <a className="lp-button lp-button-dark" href="#seu-match">Encontre seu treinador <span aria-hidden="true">↗</span></a>
      </div>
    </section>

    <section className="lp-intro lp-wrap" id="como-funciona" aria-labelledby="intro-title">
      <h2 id="intro-title">Entre o primeiro passo<br />e a próxima conquista,<br />existe um <span className="lp-highlight lp-highlight-sage">bom encontro.</span></h2>
      <p className="lp-intro-description">A LinkAtletas aproxima você de treinadores compatíveis com seus objetivos, sua rotina e seu jeito de treinar. Do primeiro match ao acompanhamento, tudo no mesmo lugar.</p>
      <div className="lp-intro-bottom"><span>Você traz a vontade.</span><img src="/landing/logo.svg" width="38" height="38" alt="" /><span>A gente abre o caminho.</span></div>
    </section>

    <section className="lp-sport-section" aria-labelledby="sport-title">
      <div className="lp-sport-title lp-wrap"><h2 id="sport-title">Não existe um jeito <br />único de <span className="lp-highlight lp-highlight-lilac">ir além.</span></h2><p>Tem quem corra. Tem quem pedale.<br />Tem quem esteja começando agora.<br />O ponto em comum? Vontade de evoluir.</p></div>
      <div className="lp-sport-strip">
        {sportPanels.map((panel, index) => {
          const active = activeSportPanel === index
          const contentId = `sport-panel-${index}`

          return <div key={panel.label} className={`lp-sport-panel ${panel.image ? 'lp-sport-photo' : 'lp-sport-message'}`} data-active={active} onPointerEnter={(event) => {
            if (event.pointerType === 'mouse' && !event.currentTarget.parentElement?.querySelector(':focus-visible')) setActiveSportPanel(index)
          }}>
            {panel.image && <img src={`/landing/${panel.image}`} alt={panel.alt} loading="lazy" width="1200" height={panel.height} />}
            <button type="button" className="lp-sport-trigger" aria-expanded={active} aria-controls={contentId} aria-label={panel.label} onClick={() => setActiveSportPanel(index)}>
              {!active && <span>{panel.label}</span>}
            </button>
            <div id={contentId} className="lp-sport-content" hidden={!active}>
              {panel.sport ? <a href="#seu-match" data-sport={panel.sport} className="lp-sport-link">
                <span><small>{panel.label}</small>{panel.title}</span><span aria-hidden="true">↗</span>
              </a> : <>{panel.message}{panel.note}</>}
            </div>
          </div>
        })}
      </div>
    </section>

    <section className="lp-audiences" aria-label="Para atletas e para treinadores">
      <article className="lp-audience lp-audience-athlete" id="atletas">
        <div className="lp-audience-heading"><h2>Seu objetivo.<br /><span>Do seu jeito.</span></h2></div>
        <div className="lp-audience-image"><img src="/landing/corrida.jpg" alt="Corredor treinando em uma pista vermelha sob o céu azul" loading="lazy" width="1200" height="1800" /><span className="lp-image-sticker">Um passo<br />de cada vez.</span></div>
        <div className="lp-audience-caption"><div><span className="lp-small-label">Para atletas</span><p>Encontre quem entende sua meta.<br />Treine com direção, no seu ritmo.</p></div><a href="#seu-match" className="lp-text-link">Quero meu match <span aria-hidden="true">↗</span></a></div>
      </article>
      <article className="lp-audience lp-audience-coach" id="treinadores">
        <div className="lp-audience-heading"><h2>Seu conhecimento.<br /><span>Mais longe.</span></h2><span className="lp-round-arrow" aria-hidden="true">↗</span></div>
        <div className="lp-audience-image"><img src="/landing/treino-acompanhado.webp" alt="Treinador orientando uma atleta durante um exercício" loading="lazy" width="1774" height="887" /><span className="lp-image-sticker lp-sticker-coach">Talento bom<br />se compartilha.</span></div>
        <div className="lp-audience-caption"><div><span className="lp-small-label">Para treinadores · Juntos, mais longe.</span><p>Conecte-se a novos atletas.<br />Organize treinos, vídeos e feedbacks.</p></div><Link to="/login?cadastro=1&perfil=treinador" className="lp-text-link">Sou treinador <span aria-hidden="true">↗</span></Link></div>
      </article>
    </section>

    <section className="lp-care lp-wrap" id="recursos" aria-labelledby="care-title">
      <div className="lp-section-heading"><h2 id="care-title">Boa conexão.<br />Melhor acompanhamento.</h2><p>O que importa para evoluir,<br />sem complicar a sua rotina.</p></div>
      <div className="lp-care-grid">
        <article className="lp-care-cell lp-cell-lilac"><span className="lp-cell-symbol" aria-hidden="true">↔</span><h3>Um match que<br />faz sentido.</h3><p>Modalidade, objetivo, orçamento e disponibilidade ajudam a encontrar profissionais compatíveis com você.</p><span className="lp-cell-bottom">Seu contexto vem primeiro.</span></article>
        <article className="lp-care-cell lp-cell-sage"><svg className="lp-care-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="m24 4 16 6v12c0 10-16 21-16 21S8 32 8 22V10l16-6Z" stroke="currentColor" strokeWidth="2"/><path d="m17 23 5 5 10-11" stroke="currentColor" strokeWidth="2"/></svg><h3>Confiança antes<br />do primeiro treino.</h3><p>Treinadores passam pela conferência do CREF e da documentação antes de aparecerem na plataforma.</p><span className="lp-cell-bottom">Profissionais verificados.</span></article>
        <article className="lp-care-cell lp-cell-peach"><span className="lp-cell-symbol" aria-hidden="true">⌁</span><h3>Toda a jornada.<br />Um só lugar.</h3><p>Seu plano, registros, vídeos de execução e feedbacks seguem juntos. Menos ferramentas, mais presença.</p><span className="lp-cell-bottom">A evolução é uma conversa.</span></article>
      </div>
    </section>

    <section className="lp-journey lp-wrap" aria-labelledby="journey-title">
      <h2 id="journey-title">Um encontro. <br />Um plano.<br /><span className="lp-soft-text">Um novo começo.</span></h2>
      <ol className="lp-journey-list">
        <li><span className="lp-step-number">01</span><div><h3>Conte a sua história.</h3><p>Sua modalidade, nível, objetivos e rotina. Um perfil que mostra o que faz sentido para você.</p></div><span className="lp-step-mark" aria-hidden="true">↗</span></li>
        <li><span className="lp-step-number">02</span><div><h3>Encontre a sua conexão.</h3><p>Compare compatibilidade, avaliações e formas de atendimento. Escolha com mais clareza.</p></div><span className="lp-step-mark" aria-hidden="true">↗</span></li>
        <li><span className="lp-step-number">03</span><div><h3>Transforme vontade em movimento.</h3><p>Receba seu plano, registre os treinos e converse com seu treinador ao longo do caminho.</p></div><span className="lp-step-mark" aria-hidden="true">↗</span></li>
      </ol>
    </section>

    <section className="lp-match-section lp-wrap" id="seu-match" aria-labelledby="match-title">
      <div className="lp-match-intro"><h2 id="match-title">Que tal encontrar<br /><span>o seu caminho?</span></h2><p>Três respostas para dar forma<br />ao seu próximo passo.</p><img src="/landing/logo.svg" width="100" height="100" alt="" className="lp-match-logo" /></div>
      <form className="lp-match-form" id="match-form" onSubmit={submitMatch}>
        <label htmlFor="sport"><span>O que te coloca em movimento?</span><select id="sport" name="sport" required value={answers.sport} onChange={event => { setAnswers({ ...answers, sport: event.target.value }); setResult(null) }}><option value="">Escolha sua modalidade</option><option>Corrida</option><option>Musculação</option><option>Ciclismo</option><option>Outra modalidade</option></select></label>
        <label htmlFor="goal"><span>Qual é o seu momento?</span><select id="goal" name="goal" required value={answers.goal} onChange={event => { setAnswers({ ...answers, goal: event.target.value }); setResult(null) }}><option value="">Conte seu objetivo</option><option value="começar">Quero começar</option><option value="constância">Busco mais constância</option><option value="performance">Quero melhorar minha performance</option></select></label>
        <label htmlFor="format"><span>Como você prefere treinar?</span><select id="format" name="format" required value={answers.format} onChange={event => { setAnswers({ ...answers, format: event.target.value }); setResult(null) }}><option value="">Escolha o formato</option><option>Online</option><option>Presencial</option><option>Híbrido</option></select></label>
        <button className="lp-button lp-button-dark" type="submit">Descobrir meu próximo passo <span aria-hidden="true">↗</span></button>
        <div className="lp-match-result" id="match-result" role="status" ref={resultElement} hidden={!result}>{result && <>
          <h3>Seu próximo passo já tem direção.</h3>
          <p>{result.sport} · Acompanhamento {result.format.toLowerCase()}. {goalCopy[result.goal]}</p>
          <Link className="lp-text-link" to="/login?cadastro=1&perfil=atleta">Criar meu perfil na LinkAtletas ↗</Link>
          <small>Prévia de jornada. A busca de profissionais acontece na plataforma, após o cadastro.</small>
        </>}</div>
      </form>
    </section>

    <section className="lp-manifesto lp-wrap" aria-labelledby="manifesto-title"><p className="lp-manifesto-note">Um bom encontro muda o jogo.</p><div className="lp-manifesto-line"><span>Vontade.</span><span className="lp-mini-flower" aria-hidden="true">✳</span><span>Direção.</span><span className="lp-mini-flower" aria-hidden="true">✳</span><span>Conexão.</span></div><h2 id="manifesto-title">Performance é pessoal.<br />O caminho não precisa<br />ser <span className="lp-highlight lp-highlight-peach">solitário.</span></h2><a className="lp-text-link" href="#seu-match">Encontre quem evolui com você <span aria-hidden="true">↗</span></a></section>

    <section className="lp-faq lp-wrap" id="perguntas" aria-labelledby="faq-title">
      <div className="lp-faq-visual"><h2 id="faq-title">Antes do<br />primeiro passo.</h2><img src="/landing/treino-acompanhado.webp" alt="Atleta concentrada com o apoio de seu treinador" loading="lazy" width="1774" height="887" /><p>Boas perguntas também<br />fazem parte do caminho.</p></div>
      <MotionAccordion className="lp-faq-list" items={landingFaqs} />
    </section>

    <section className="lp-closing lp-wrap" aria-labelledby="closing-title"><h2 id="closing-title">O próximo capítulo<br />é <span className="lp-highlight lp-highlight-sage">em movimento.</span></h2><div className="lp-closing-actions"><a className="lp-button lp-button-dark" href="#seu-match">Quero encontrar meu treinador <span aria-hidden="true">↗</span></a><Link className="lp-text-link" to="/login?cadastro=1&perfil=treinador">Quero cadastrar como treinador <span aria-hidden="true">↗</span></Link></div></section>
  </main>

  <footer className="lp-site-footer">
    <div className="lp-footer-top"><p>Gente conecta gente.<br />O esporte faz o resto.</p><nav aria-label="Links do rodapé"><a href="#como-funciona">Como funciona</a><a href="#recursos">Recursos</a><a href="#perguntas">Perguntas</a><Link to="/login">Entrar na plataforma ↗</Link></nav><a className="lp-back-top" href="#inicio">De volta ao início <span aria-hidden="true">↑</span></a></div>
    <div className="lp-footer-wordmark" aria-label="LinkAtletas"><img src="/landing/logo.svg" alt="" width="150" height="150" /><span>Link<span className="lp-footer-wordmark__accent">Atletas</span></span></div>
    <div className="lp-footer-bottom"><span>© 2026 LinkAtletas</span><span>Movimento em comum.</span></div>
  </footer>
  </div>
}

(() => {
  'use strict';
  // Sempre começar do topo ao recarregar a página
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  // 'instant' ignora o `scroll-behavior: smooth` do CSS (senão ele "desliza" até o topo
  // ou é interrompido); repetimos no load, depois que o navegador tenta restaurar.
  const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  toTop();
  window.addEventListener('DOMContentLoaded', toTop);
  window.addEventListener('load', () => {
    toTop();
    if (window.ScrollTrigger) {
      window.ScrollTrigger.clearScrollMemory?.('manual');
      window.ScrollTrigger.refresh();
    }
  });
  window.addEventListener('pageshow', toTop);
  window.addEventListener('beforeunload', toTop);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* =========================================================
     1. FAIXA EXPANSÍVEL DE MODALIDADES (Fiel ao vídeo/landing atual)
  ========================================================= */
  const sportStrip = document.getElementById('sport-strip');
  if (sportStrip) {
    const panels = [...sportStrip.querySelectorAll('.sport-panel')];

    const activatePanel = (activeIndex) => {
      panels.forEach((panel, idx) => {
        const isActive = idx === activeIndex;
        panel.dataset.active = String(isActive);
        const trigger = panel.querySelector('.sport-trigger');
        const content = panel.querySelector('.sport-content');
        if (trigger) trigger.setAttribute('aria-expanded', String(isActive));
        if (content) content.hidden = !isActive;
      });
    };

    panels.forEach((panel, idx) => {
      const trigger = panel.querySelector('.sport-trigger');
      trigger?.addEventListener('click', () => activatePanel(idx));
      panel.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse' && !sportStrip.querySelector(':focus-visible')) {
          activatePanel(idx);
        }
      });
    });
  }

  /* =========================================================
     2. REACT BITS — SCROLL EXPAND ("BUILD TO SCALE")
        Port fiel da lógica enviada (useWindowScroll = true)
  ========================================================= */
  function initScrollExpand() {
    const root = document.getElementById('scroll-expand-root');
    const track = document.getElementById('scroll-expand-track');
    const stage = document.getElementById('scroll-expand-stage');
    const frame = document.getElementById('scroll-expand-frame');
    const media = document.getElementById('scroll-expand-media');
    const scrim = document.getElementById('scroll-expand-scrim');
    const title = document.getElementById('scroll-expand-title');
    const hint = document.getElementById('scroll-expand-hint');
    const overlay = document.getElementById('scroll-expand-overlay');

    if (!root || !track || !stage || !frame || !media) return;

    const config = {
      startWidth: 42,
      startHeight: 58,
      startRadius: 24,
      endRadius: 0,
      mediaZoom: 1.35,
      scrollDistance: 1.2,
      holdDistance: 0.45,
      smoothing: 0.1,
      overlayScrim: 0.62,
      enabled: true
    };

    const applyProgress = (p) => {
      const e = smoothstep(0, 1, p);
      const isMobile = window.innerWidth <= 768;
      const startW = isMobile ? 76 : config.startWidth;
      const startH = isMobile ? 54 : config.startHeight;

      const w = startW + (100 - startW) * e;
      const h = startH + (100 - startH) * e;
      const ix = Math.max(0, (100 - w) / 2);
      const iy = Math.max(0, (100 - h) / 2);
      const r = config.startRadius + (config.endRadius - config.startRadius) * e;

      frame.style.clipPath = `inset(${iy}% ${ix}% ${iy}% ${ix}% round ${r}px)`;
      media.style.transform = `scale(${config.mediaZoom + (1 - config.mediaZoom) * e})`;

      if (scrim) {
        scrim.style.opacity = `${config.overlayScrim * e}`;
      }

      if (title) {
        const out = smoothstep(0.4, 0.88, p);
        title.style.opacity = `${1 - out}`;
        title.style.transform = `translate3d(0, ${-28 * out}px, 0) scale(${1 + 0.06 * out})`;
      }

      if (hint) {
        const gone = smoothstep(0, 0.12, p);
        hint.style.opacity = `${1 - gone}`;
        hint.style.transform = `translate3d(0, ${8 * gone}px, 0)`;
      }

      if (overlay) {
        const inn = smoothstep(0.68, 1, p);
        overlay.style.opacity = `${inn}`;
        overlay.style.transform = `translate3d(0, ${18 * (1 - inn)}px, 0)`;
        overlay.style.pointerEvents = inn > 0.5 ? 'auto' : 'none';
      }
    };

    let raf = 0;
    let current = 0;
    let target = 0;
    let stageH = 0;
    let running = false;

    const measure = () => {
      stageH = window.innerHeight;
      if (stageH <= 0) return;
      stage.style.height = `${stageH}px`;
      track.style.height = `${stageH * (1 + Math.max(0, config.scrollDistance) + Math.max(0, config.holdDistance))}px`;
      const w = root.clientWidth || stageH;
      stage.style.setProperty('--se-title-size', `${clamp(w * 0.048, 22, 64)}px`);
    };

    const readProgress = () => {
      if (!config.enabled || reduceMotion) return 1;
      const span = stageH * Math.max(0.01, config.scrollDistance);
      const top = track.getBoundingClientRect().top;
      return clamp(-top / span, 0, 1);
    };

    const tick = () => {
      const k = config.smoothing <= 0 ? 1 : 1 - Math.exp(-1 / (60 * config.smoothing));
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.0004) {
        current = target;
        running = false;
      }
      applyProgress(current);
      raf = running ? requestAnimationFrame(tick) : 0;
    };

    const kick = () => {
      if (running) return;
      running = true;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      target = readProgress();
      if (config.smoothing <= 0 || reduceMotion) {
        current = target;
        applyProgress(current);
        return;
      }
      kick();
    };

    const onResize = () => {
      measure();
      target = readProgress();
      current = target;
      applyProgress(current);
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    };

    measure();
    target = readProgress();
    current = target;
    applyProgress(current);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(onResize);
      ro.observe(root);
    }
  }

  initScrollExpand();

  /* =========================================================
     2B. REACT BITS — SCROLL STACK (RECURSOS NA PRÁTICA)
         Port vanilla da lógica enviada (useWindowScroll = true).
         Roda antes do GSAP para o ScrollTrigger medir o layout final.
  ========================================================= */
  function initScrollStack(root, options = {}) {
    const inner = root?.querySelector('.scroll-stack__inner');
    const end = root?.querySelector('.scroll-stack__end');
    if (!root || !inner || !end) return;

    const settings = {
      itemDistance: 100,
      itemStackDistance: 24,
      stackPosition: '12%',
      itemScale: 0.05,
      baseScale: 0.8,
      dimAmount: 0.3,
      blurAmount: 0,
      tiltAmount: 0,
      rotationAmount: 0,
      holdDistance: 200,
      // smoothScroll sequestra a roda do mouse na página inteira; fica
      // desligado para não brigar com o ScrollExpand e o ScrollTrigger.
      smoothScroll: false,
      snap: false,
      onStackComplete: null,
      ...options
    };

    const resolveOffset = (value, size) => {
      if (typeof value === 'number') return value;
      const text = String(value).trim();
      if (text.endsWith('%')) return (parseFloat(text) / 100) * size;
      return parseFloat(text) || 0;
    };
    const toLength = (value) => (typeof value === 'number' ? `${value}px` : value);

    const scrollsInside = (node, stop, delta) => {
      for (let el = node; el && el !== stop; el = el.parentElement) {
        if (el.scrollHeight <= el.clientHeight + 1) continue;
        const overflow = getComputedStyle(el).overflowY;
        if (overflow !== 'auto' && overflow !== 'scroll') continue;
        if (delta > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
      }
      return false;
    };

    // Monta a estrutura do componente: espaçador + slot sticky por card.
    const cards = [...inner.querySelectorAll(':scope > .scroll-stack-card')];
    const total = cards.length;
    cards.forEach((card, index) => {
      if (index > 0) {
        const gap = settings.itemDistance - (total - index) * settings.itemStackDistance;
        const spacer = document.createElement('div');
        spacer.setAttribute('aria-hidden', 'true');
        spacer.style.height = `${Math.max(0, gap)}px`;
        spacer.style.marginTop = `${Math.min(0, gap)}px`;
        inner.insertBefore(spacer, card);
      }
      const slot = document.createElement('div');
      slot.setAttribute('data-stack-slot', '');
      slot.className = 'scroll-stack__slot';
      slot.style.top = `calc(${toLength(settings.stackPosition)} + ${index * settings.itemStackDistance}px)`;
      slot.style.marginBottom = `${(total - 1 - index) * settings.itemStackDistance}px`;
      slot.style.zIndex = String(index + 1);
      inner.insertBefore(slot, card);
      slot.appendChild(card);
    });

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cache = new Map();
    let frame = 0;
    let glide = 0;
    let rest = 0;
    let complete = false;
    let gliding = false;
    let pressed = false;
    let current = 0;
    let goal = 0;
    let written = 0;
    let last = 0;
    let points = [];
    let reach = 0;

    const readScroll = () => window.scrollY;
    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
    const writeScroll = (value) => {
      written = value;
      window.scrollTo({ top: value, behavior: 'instant' });
    };
    const write = (key, value, apply) => {
      if (cache.get(key) === value) return false;
      cache.set(key, value);
      apply(value);
      return true;
    };

    const update = () => {
      frame = 0;
      const slots = [...inner.children].filter((c) => c.hasAttribute('data-stack-slot'));
      if (!slots.length) return;

      const viewHeight = window.innerHeight;
      const stackTop = resolveOffset(settings.stackPosition, viewHeight);
      const offset = settings.itemStackDistance;
      const heights = slots.map((s) => s.offsetHeight);
      const tops = slots.map((s) => s.getBoundingClientRect().top);

      const moved = write('endHeight', settings.holdDistance, (v) => { end.style.height = `${v}px`; });

      let flow = inner.getBoundingClientRect().top + readScroll();
      points = heights.map((height, i) => {
        const point = flow - stackTop - i * offset;
        flow += height + settings.itemDistance;
        return point;
      });
      reach = Math.max(40, (heights[0] + settings.itemDistance - offset) / 2);

      const depths = slots.map(() => 0);
      let lastCover = 0;
      for (let j = 1; j < slots.length; j++) {
        const pinBefore = stackTop + (j - 1) * offset;
        const start = pinBefore + heights[j - 1];
        const span = Math.max(1, start - pinBefore - offset);
        const cover = Math.min(1, Math.max(0, (start - tops[j]) / span));
        for (let i = 0; i < j; i++) depths[i] += cover;
        lastCover = cover;
      }

      const dimStep = Math.min(Math.max(settings.dimAmount, 0), 1);
      slots.forEach((slot, i) => {
        const card = slot.firstElementChild;
        if (!card) return;
        const depth = depths[i];
        const lean = Math.min(depth, 1);
        const scale = Math.max(Math.min(settings.baseScale, 1), 1 - depth * settings.itemScale);
        const tilt = -lean * settings.tiltAmount;
        const turn = lean * settings.rotationAmount * (i % 2 ? -1 : 1);
        const blur = depth * settings.blurAmount;
        const dim = 1 - Math.pow(1 - dimStep, depth);
        const transform = depth < 0.0005
          ? ''
          : `perspective(1200px) rotateX(${tilt.toFixed(2)}deg) rotate(${turn.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
        write(`transform${i}`, transform, (v) => { card.style.transform = v; });
        write(`filter${i}`, blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : '', (v) => { card.style.filter = v; });
        write(`dim${i}`, dim.toFixed(3), (v) => { card.style.setProperty('--scroll-stack-dim', v); });
      });

      const done = slots.length > 1 && lastCover >= 0.999;
      if (done !== complete) {
        complete = done;
        if (done) settings.onStackComplete?.();
      }

      if (moved) schedule();
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (Math.abs(readScroll() - written) > 2) {
        gliding = false;
        glide = 0;
        settleSoon();
        return;
      }
      current += (goal - current) * (1 - Math.pow(0.9, dt * 60));
      if (Math.abs(goal - current) < 0.5) current = goal;
      writeScroll(current);
      if (current === goal) {
        gliding = false;
        glide = 0;
        settleSoon();
        return;
      }
      glide = requestAnimationFrame(step);
    };

    const glideTo = (value) => {
      goal = Math.min(Math.max(value, 0), maxScroll());
      if (motion.matches) {
        writeScroll(goal);
        return;
      }
      if (gliding) return;
      gliding = true;
      current = readScroll();
      written = current;
      last = performance.now();
      glide = requestAnimationFrame(step);
    };

    const settle = () => {
      rest = 0;
      if (!settings.snap || gliding || pressed || !points.length) return;
      const now = readScroll();
      const nearest = points.reduce((best, p) => (Math.abs(p - now) < Math.abs(best - now) ? p : best));
      const gap = Math.abs(nearest - now);
      if (gap > 1 && gap < reach) glideTo(nearest);
    };

    const settleSoon = () => {
      window.clearTimeout(rest);
      rest = window.setTimeout(settle, 140);
    };

    const onScroll = () => {
      schedule();
      if (!gliding) settleSoon();
    };

    const onWheel = (event) => {
      if (!settings.smoothScroll || motion.matches || event.defaultPrevented || event.ctrlKey) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const page = window.innerHeight;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? page : 1);
      if (!delta || scrollsInside(event.target, document.body, delta)) return;
      const base = gliding ? goal : readScroll();
      if ((delta < 0 && base <= 0) || (delta > 0 && base >= maxScroll() - 0.5)) return;
      event.preventDefault();
      window.clearTimeout(rest);
      glideTo(base + delta);
    };

    const onPress = () => {
      pressed = true;
      window.clearTimeout(rest);
    };
    const onRelease = () => {
      if (!pressed) return;
      pressed = false;
      settleSoon();
    };

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(schedule);
      observer.observe(root);
      observer.observe(inner);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerdown', onPress, { passive: true });
    window.addEventListener('pointerup', onRelease, { passive: true });
    window.addEventListener('pointercancel', onRelease, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  }

  // Configuração do vídeo de referência: cada painel trava no topo da tela e
  // o próximo sobe por cima dele — sem respiro, sem encolher, sem escurecer.
  initScrollStack(document.getElementById('insights-stack'), {
    itemDistance: 0,
    itemStackDistance: 0,
    stackPosition: 0,
    itemScale: 0,
    baseScale: 1,
    dimAmount: 0,
    holdDistance: 160
  });

  /* =========================================================
     2C. GSAP NOS PAINÉIS DA PILHA (como no vídeo de referência)
         - imagem com leve parallax enquanto o painel sobe até o topo
         - linha de título entra em sequência ao aparecer
         - etiqueta "[ DESCOBRIR MEU MATCH ]" surge quando o painel trava
  ========================================================= */
  function initInsightsStackFx(gsap) {
    const cards = document.querySelectorAll('#insights-stack .scroll-stack-card');
    cards.forEach((card) => {
      const slot = card.parentElement;
      const img = card.querySelector('.insight-card__media img');
      const parts = card.querySelectorAll('.insight-card__index, .insight-card__bold, .insight-card__thin, .insight-card__meta');
      const tag = card.querySelector('.insight-card__cta');

      if (img) {
        gsap.fromTo(img, { yPercent: -7, scale: 1.14 }, {
          yPercent: 0,
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: slot, start: 'top bottom', end: 'top top', scrub: true }
        });
      }

      if (parts.length) {
        gsap.from(parts, {
          y: 22,
          opacity: 0,
          duration: 0.8,
          stagger: 0.07,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: { trigger: slot, start: 'top 85%', once: true }
        });
      }

      if (tag) {
        gsap.fromTo(tag, { autoAlpha: 0, y: -10, scale: 0.92 }, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.45,
          ease: 'power3.out',
          scrollTrigger: { trigger: slot, start: 'top 4%', toggleActions: 'play none none reverse' }
        });
      }
    });
  }

  /* =========================================================
     3A. TEXTO GIGANTE — VARREDURA DE COR LETRA A LETRA
         cinza apagado → lima (frente da onda) → branco,
         seguida da linha divisória e do texto complementar.
  ========================================================= */
  // Quebra o texto em <span.sw> (palavra, não quebra no meio) > <span.sc> (letra),
  // preservando elementos internos como <em>.
  function splitChars(el) {
    const chars = [];
    const walk = (node, parent) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.replace(/\s+/g, ' ').split(/( )/);
          parts.forEach((part) => {
            if (!part) return;
            if (part === ' ') {
              parent.appendChild(document.createTextNode(' '));
              return;
            }
            const word = document.createElement('span');
            word.className = 'sw';
            [...part].forEach((ch) => {
              const c = document.createElement('span');
              c.className = 'sc';
              c.textContent = ch;
              word.appendChild(c);
              chars.push(c);
            });
            parent.appendChild(word);
          });
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const clone = child.cloneNode(false);
          parent.appendChild(clone);
          walk(child, clone);
        }
      });
    };

    const label = el.textContent.replace(/\s+/g, ' ').trim();
    const inner = document.createElement('span');
    inner.setAttribute('aria-hidden', 'true');
    walk(el, inner);
    el.textContent = '';
    el.appendChild(inner);
    el.setAttribute('aria-label', label);
    // remove espaços iniciais/finais herdados da indentação do HTML
    while (inner.firstChild && inner.firstChild.nodeType === Node.TEXT_NODE) inner.firstChild.remove();
    while (inner.lastChild && inner.lastChild.nodeType === Node.TEXT_NODE) inner.lastChild.remove();
    return chars;
  }

  function initStatementSweep(gsap) {
    const section = document.querySelector('.statement-section');
    const title = section?.querySelector('[data-color-sweep]');
    if (!section || !title) return;

    const css = getComputedStyle(section);
    const dim = css.getPropertyValue('--sweep-dim').trim() || '#262C29';
    const rootCss = getComputedStyle(document.documentElement);
    const accent = rootCss.getPropertyValue('--accent').trim() || '#DFF754';
    const light = rootCss.getPropertyValue('--text-primary').trim() || '#F6F5F0';

    const chars = splitChars(title);
    if (!chars.length) return;

    // Cada letra: cinza → lima (rápido) e depois lima → branco (lento).
    // O stagger faz a "frente" lima atravessar o texto conforme o scroll.
    const step = 0.06;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: title,
        start: 'top 88%',
        end: 'bottom 42%',
        scrub: 0.6
      }
    });

    tl.fromTo(chars, { color: dim }, { color: accent, duration: 0.12, stagger: step }, 0)
      .fromTo(chars, { color: accent }, { color: light, duration: 0.55, stagger: step, immediateRender: false }, 0.22);

    // Linha divisória cresce da esquerda e o texto complementar "acende".
    const rule = section.querySelector('.statement-rule');
    const info = section.querySelector('.statement-info');
    const lit = section.querySelectorAll('.statement-label, .statement-copy');
    const foot = section.querySelector('.statement-foot');

    const infoTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: rule || info,
        start: 'top 92%',
        end: 'top 52%',
        scrub: 0.6
      }
    });

    if (rule) infoTl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
    if (lit.length) infoTl.fromTo(lit, { opacity: 0.16 }, { opacity: 1, duration: 0.7, stagger: 0.15 }, 0.25);
    if (foot) infoTl.fromTo(foot, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5 }, 0.55);
  }

  /* =========================================================
     3. GSAP + SCROLLTRIGGER — COREOGRAFIA SCROLL-DRIVEN EM
        TODAS AS SEÇÕES (CADA CAPÍTULO REAGE AO SCROLL)
  ========================================================= */
  function splitWords(el) {
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const words = [];
    text.split(' ').forEach((word, idx, arr) => {
      const span = document.createElement('span');
      span.className = 'rw';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = word;
      el.appendChild(span);
      words.push(span);
      if (idx < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return words;
  }

  function initGsapChapters() {
    if (reduceMotion || !window.gsap || !window.ScrollTrigger) return;

    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);

    // `html { scroll-behavior: smooth }` faz o refresh do ScrollTrigger medir
    // posições erradas (ele rola até 0 e volta durante a medição).
    const docEl = document.documentElement;
    ScrollTrigger.addEventListener('refreshInit', () => { docEl.style.scrollBehavior = 'auto'; });
    ScrollTrigger.addEventListener('refresh', () => { docEl.style.scrollBehavior = ''; });

    // Barra global de progresso no topo (0% → 100% da página)
    const progressBar = document.getElementById('scroll-progress');
    if (progressBar) {
      gsap.to(progressBar, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.15
        }
      });
    }

    // ---------------------------------------------------------
    // CAPÍTULO 1: HERO — Entrada cinematográfica + Saída com profundidade no scroll
    // ---------------------------------------------------------
    // Texto do hero: efeito "BlurText" (React Bits) — palavras entram de cima
    // para baixo com blur, em cascata, assim que a página carrega.
    const blurTextIn = (elements, { delay = 0, stagger = 120, distance = 50, blur = 10, duration = 700 } = {}) => {
      const pieces = [];
      elements.forEach(el => {
        if (!el) return;
        if (el.matches('svg')) { pieces.push(el); return; }
        const words = el.textContent.trim().split(/\s+/);
        el.setAttribute('aria-label', words.join(' '));
        el.textContent = '';
        words.forEach((word, i) => {
          const span = document.createElement('span');
          span.setAttribute('aria-hidden', 'true');
          span.style.display = 'inline-block';
          span.style.willChange = 'transform, filter, opacity';
          span.textContent = word;
          el.appendChild(span);
          if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
          pieces.push(span);
        });
      });
      if (reduceMotionHero) return;
      pieces.forEach((piece, i) => {
        piece.animate([
          { filter: `blur(${blur}px)`, opacity: 0, transform: `translateY(${-distance}px)` },
          { filter: `blur(${blur / 2}px)`, opacity: 0.5, transform: `translateY(${distance / 10}px)`, offset: 0.5 },
          { filter: 'blur(0px)', opacity: 1, transform: 'translateY(0)' }
        ], {
          duration,
          delay: delay + i * stagger,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'backwards'
        });
      });
    };
    const reduceMotionHero = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    blurTextIn([
      document.querySelector('.hero-link-glyph'),
      document.querySelector('.hero-lines-word'),
      document.querySelector('.hero-line-two')
    ], { delay: 250, stagger: 160 });
    blurTextIn([document.querySelector('.hero-subtitle')], { delay: 800, stagger: 28, distance: 30, blur: 8, duration: 480 });

    // Navbar: intro "CardNav" (React Bits) — a barra se abre de uma pílula
    // central até a largura total e os itens sobem em cascata.
    const navPill = document.querySelector('.nav-pill');
    if (navPill && !reduceMotionHero) {
      const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
      const width = navPill.offsetWidth;
      const height = navPill.offsetHeight;
      const radius = parseFloat(getComputedStyle(navPill).borderTopLeftRadius) || 18;
      navPill.animate([
        { clipPath: `inset(0px ${Math.max(0, (width - height) / 2)}px round ${height / 2}px)`, opacity: 0 },
        { clipPath: `inset(0px 0px round ${radius}px)`, opacity: 1 }
      ], { duration: 1700, easing: ease, fill: 'backwards' });
      Array.from(navPill.children).forEach((child, index) => {
        child.animate([
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 1000, delay: 500 + index * 150, easing: ease, fill: 'backwards' });
      });
    }

    const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    heroTl
      .from('.hero-frame', { scale: 1.03, opacity: 0.4, duration: 1.2 })
      .from('.hero-scroll-cue', { y: 36, opacity: 0, duration: 1.05 }, 1.2);

    const heroExitTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '.hero-shell',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6
      }
    });
    heroExitTl
      .to('.hero-bg', { yPercent: 14, scale: 1.08 }, 0)
      .to('.hero-content', { y: -68, opacity: 0.12 }, 0)
      .to('.hero-scroll-cue', { y: 18, opacity: 0 }, 0);

    // ---------------------------------------------------------
    // CAPÍTULO 2: MANIFESTO — Iluminação palavra a palavra no scroll
    // ---------------------------------------------------------
    const manifestoEl = document.querySelector('[data-chapter="manifesto"]');
    const manifestoHeading = manifestoEl?.querySelector('[data-word-reveal]');
    if (manifestoEl && manifestoHeading) {
      const words = splitWords(manifestoHeading);
      const manifestoMeta = manifestoEl.querySelectorAll('.gs-stagger');

      const manifestoTl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: manifestoEl,
          start: 'top 84%',
          end: 'bottom 48%',
          scrub: 0.65
        }
      });

      manifestoTl
        .fromTo(words, { opacity: 0.14, y: 12 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.5 }, 0)
        .fromTo(manifestoMeta, { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.15, duration: 0.45 }, 0.55);
    }

    // ---------------------------------------------------------
    // CAPÍTULO 3: FAIXA EXPANSÍVEL DE MODALIDADES — Onda 3D no scroll
    // ---------------------------------------------------------
    const sportsEl = document.querySelector('[data-chapter="sports"]');
    if (sportsEl) {
      const sportTitles = sportsEl.querySelectorAll('.gs-stagger');
      const sportPanels = sportsEl.querySelectorAll('.gs-panel');

      const sportsTl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: {
          trigger: sportsEl,
          start: 'top 88%',
          end: 'top 22%',
          scrub: 0.7
        }
      });

      sportsTl
        .fromTo(sportTitles, { y: 36, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.45 }, 0)
        .fromTo(
          sportPanels,
          { y: 78, rotateX: 10, scale: 0.93, opacity: 0 },
          { y: 0, rotateX: 0, scale: 1, opacity: 1, stagger: 0.1, duration: 0.65 },
          0.18
        );
    }

    // ---------------------------------------------------------
    // CAPÍTULO 4: SCROLL EXPAND (já gerenciado por initScrollExpand)
    // CAPÍTULO 5: PARA TREINADORES — Varredura de cor letra a letra (StatementSweep)
    // ---------------------------------------------------------
    initStatementSweep(gsap);

    // ---------------------------------------------------------
    // CAPÍTULO 6: FAIXA DE MODALIDADES — Velocidade ligada ao scroll
    // ---------------------------------------------------------
    const marqueeEl = document.querySelector('[data-chapter="marquee"]');
    const marqueeInner = marqueeEl?.querySelector('.logos-marquee');
    if (marqueeEl && marqueeInner) {
      gsap.fromTo(
        marqueeInner,
        { xPercent: 5, opacity: 0.35 },
        {
          xPercent: -9,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: marqueeEl,
            start: 'top 95%',
            end: 'bottom 10%',
            scrub: 0.5
          }
        }
      );
    }

    // ---------------------------------------------------------
    // CAPÍTULO 7: TEXTO FIXO À ESQUERDA + INFORMAÇÕES PASSANDO
    // SUAVEMENTE À DIREITA COM INÉRCIA GSAP (ESTILO LENIS)
    // ---------------------------------------------------------
    const pillarsEl = document.querySelector('[data-chapter="pillars"]');
    if (pillarsEl) {
      const viewport = pillarsEl.querySelector('.pillars-viewport');
      const stream = pillarsEl.querySelector('#pillars-stream');
      const entries = [...pillarsEl.querySelectorAll('.pillar-entry')];
      const bigReel = pillarsEl.querySelector('#pillars-bignum-reel');

      const updateFocus = (progress, focusIndex) => {
        const count = entries.length || 1;
        const idx = focusIndex ?? Math.min(count - 1, Math.floor(progress * count));
        entries.forEach((entry, i) => entry.classList.toggle('is-focus', i === idx));
      };

      const mm = gsap.matchMedia();
      mm.add('(min-width: 901px)', () => {
        if (!viewport || !stream) return;

        // Título entra "rasgando": cada linha sobe de baixo da máscara,
        // inclinada e esticada, antes do pin começar.
        const lines = pillarsEl.querySelectorAll('.pillars-line > span');
        gsap.fromTo(lines,
          { yPercent: 125, skewY: 12, scaleY: 1.6, rotate: 4 },
          {
            yPercent: 0,
            skewY: 0,
            scaleY: 1,
            rotate: 0,
            ease: 'power2.out',
            stagger: 0.16,
            scrollTrigger: { trigger: pillarsEl, start: 'top 95%', end: 'top top', scrub: 1.4 }
          }
        );

        // Os itens atravessam a tela inteira: entram por baixo, passam pelo
        // centro em foco e saem por cima. Pin longo + scrub pesado = mais demorado.
        const vh = () => viewport.clientHeight;
        const streamStart = () => vh() * 0.66;
        const streamEnd = () => -(stream.offsetHeight + vh() * 0.08);
        const distance = () => streamStart() - streamEnd();

        // Cada item reage à distância do centro: escala, inclinação 3D, blur e fade.
        const paintEntries = () => {
          const vRect = viewport.getBoundingClientRect();
          const center = vRect.top + vRect.height / 2;
          const half = vRect.height / 2;
          let nearest = 0;
          let nearestA = Infinity;
          entries.forEach((entry, i) => {
            const r = entry.getBoundingClientRect();
            const d = gsap.utils.clamp(-1.4, 1.4, (r.top + r.height / 2 - center) / half);
            const a = Math.abs(d);
            if (a < nearestA) { nearestA = a; nearest = i; }
            gsap.set(entry, {
              opacity: Math.max(0, 1 - Math.pow(a, 1.6) * 0.95),
              scale: 1 - a * 0.16,
              rotateX: d * -38,
              x: a * a * 70,
              filter: `blur(${(a * a * 9).toFixed(2)}px)`
            });
          });
          return nearest;
        };

        // Posição do stream que deixa o item i centralizado na janela
        // (alinhado ao numeral gigante do fundo).
        const centeredY = (i) => () =>
          vh() / 2 - (entries[i].offsetTop + entries[i].offsetHeight / 2);

        // Cada item desliza até o centro, TRAVA ali por um trecho do scroll
        // (leitura confortável sobre o número) e só então segue adiante.
        const MOVE = 1;
        const HOLD = 0.9;
        const streamTl = gsap.timeline({
          scrollTrigger: {
            trigger: pillarsEl,
            start: 'top top',
            end: () => `+=${Math.round(distance() * 2.1)}`,
            pin: true,
            scrub: 1.1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onRefresh: paintEntries
          },
          onUpdate() {
            const idx = paintEntries();
            updateFocus(this.progress(), idx);
          }
        });

        streamTl.set(stream, { y: () => streamStart() });
        if (bigReel) streamTl.set(bigReel, { yPercent: 0 }, 0);
        entries.forEach((_, i) => {
          streamTl.to(stream, { y: centeredY(i), duration: MOVE, ease: 'power2.inOut' });
          // O numeral rola junto com o texto, no mesmo trecho de scroll
          if (bigReel && i > 0) {
            streamTl.to(bigReel, {
              yPercent: (-100 / entries.length) * i,
              duration: MOVE,
              ease: 'power2.inOut'
            }, '<');
          }
          streamTl.to({}, { duration: HOLD });
        });
        streamTl.to(stream, { y: () => streamEnd(), duration: MOVE, ease: 'power2.in' });

        paintEntries();

        return () => {
          gsap.set(entries, { clearProps: 'opacity,transform,filter' });
          gsap.set(stream, { clearProps: 'transform' });
          if (bigReel) gsap.set(bigReel, { clearProps: 'transform' });
        };
      });

      mm.add('(max-width: 900px)', () => {
        entries.forEach((entry) => entry.classList.add('is-focus'));
        gsap.from(entries, {
          y: 36,
          opacity: 0,
          stagger: 0.16,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: pillarsEl,
            start: 'top 82%',
            end: 'bottom 60%',
            scrub: 0.6
          }
        });
      });
    }

    // ---------------------------------------------------------
    // CAPÍTULO 8: MAPA DO BRASIL + PÍLULAS — Radar cartográfico no scroll
    // ---------------------------------------------------------
    const hubsEl = document.querySelector('[data-chapter="hubs"]');
    if (hubsEl) {
      const mapPanel = hubsEl.querySelector('.hubs-map-panel');
      const mapLand = hubsEl.querySelector('.map-land');
      const routePaths = [...hubsEl.querySelectorAll('.map-routes path')];
      const hubsHeader = hubsEl.querySelector('.hubs-header');
      const pills = hubsEl.querySelectorAll('.gs-pill');

      routePaths.forEach((p) => {
        const len = typeof p.getTotalLength === 'function' ? p.getTotalLength() : 160;
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
      });

      const hubsTl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: {
          trigger: hubsEl,
          start: 'top 85%',
          end: 'top 18%',
          scrub: 0.7
        }
      });

      if (mapPanel) {
        hubsTl.fromTo(
          mapPanel,
          { clipPath: 'inset(10% 8% 10% 8% round 22px)', scale: 0.94, opacity: 0.3 },
          { clipPath: 'inset(0% 0% 0% 0% round 10px)', scale: 1, opacity: 1, duration: 0.7 },
          0
        );
      }
      if (mapLand) {
        hubsTl.fromTo(mapLand, { scale: 0.9, transformOrigin: 'center center', opacity: 0.35 }, { scale: 1, opacity: 1, duration: 0.65 }, 0.1);
      }
      if (routePaths.length) {
        hubsTl.to(routePaths, { strokeDashoffset: 0, stagger: 0.06, duration: 0.55 }, 0.25);
      }
      if (hubsHeader) {
        hubsTl.fromTo(hubsHeader, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45 }, 0.08);
      }
      if (pills.length) {
        hubsTl.fromTo(pills, { x: 34, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.06, duration: 0.45 }, 0.2);
      }
    }

    // ---------------------------------------------------------
    // CAPÍTULO 9: RECURSOS NA PRÁTICA (ScrollStack + GSAP scrub no cabeçalho & imagens)
    // ---------------------------------------------------------
    const insightsEl = document.querySelector('[data-chapter="insights"]');
    if (insightsEl) {
      const headerItems = insightsEl.querySelectorAll('.gs-stagger');
      gsap.fromTo(
        headerItems,
        { y: 36, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: insightsEl,
            start: 'top 86%',
            end: 'top 46%',
            scrub: 0.6
          }
        }
      );
    }
    initInsightsStackFx(gsap);

    // ---------------------------------------------------------
    // CAPÍTULO 10: FAQ — Cascata lateral no scroll
    // ---------------------------------------------------------
    const faqEl = document.querySelector('[data-chapter="faq"]');
    if (faqEl) {
      const faqHead = faqEl.querySelector('.faq-heading-col');
      const faqRows = faqEl.querySelectorAll('.gs-faq');

      const faqTl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: {
          trigger: faqEl,
          start: 'top 84%',
          end: 'top 22%',
          scrub: 0.6
        }
      });

      if (faqHead) faqTl.fromTo(faqHead, { y: 32, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35 }, 0);
      if (faqRows.length) faqTl.fromTo(faqRows, { x: 42, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.1, duration: 0.4 }, 0.1);
    }

    // ---------------------------------------------------------
    // CAPÍTULO 11: LETREIRO VAZADO GIGANTE — Deslocamento sincronizado ao scroll
    // ---------------------------------------------------------
    const giantEl = document.querySelector('[data-chapter="giant"]');
    const giantTrack = giantEl?.querySelector('.giant-marquee__track');
    if (giantEl && giantTrack) {
      gsap.fromTo(
        giantTrack,
        { xPercent: 6, opacity: 0.25 },
        {
          xPercent: -12,
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: giantEl,
            start: 'top 95%',
            end: 'bottom 10%',
            scrub: 0.5
          }
        }
      );
    }

    // ---------------------------------------------------------
    // CAPÍTULO 12: RODAPÉ — CTA monumental + entrada da grade inferior
    // ---------------------------------------------------------
    const footerEl = document.querySelector('[data-chapter="footer"]');
    if (footerEl) {
      const footerCta = footerEl.querySelector('.footer-cta');
      const footerLower = footerEl.querySelector('.footer-lower');

      if (footerCta) {
        const lineBold = footerCta.querySelector('.footer-cta__line-bold');
        const lineThin = footerCta.querySelector('.footer-cta__line-thin');
        const ctaRest = footerCta.querySelectorAll('.footer-cta__sub, .footer-cta__btn');

        if (lineBold && lineThin) {
          // Título dividido em dois: cada linha nasce na borda oposta da tela
          // e desliza até o centro, onde as duas se encontram. O CTA fica
          // fixado (pin) enquanto o scroll conduz a junção.
          const pinST = ScrollTrigger.create({
            trigger: footerCta,
            start: 'center center',
            end: '+=110%',
            pin: true,
            anticipatePin: 1
          });

          // Distância até a borda: metade da viewport + metade da própria linha,
          // deixando só um pedaço da palavra visível no início (como no vídeo).
          const edgeX = (el, dir) => () =>
            dir * (window.innerWidth / 2 + el.offsetWidth / 2 - window.innerWidth * 0.06);

          const joinTl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: footerCta,
              // Só começa quando o CTA já está centralizado e fixado na tela
              start: () => pinST.start,
              end: () => pinST.end - window.innerHeight * 0.2,
              scrub: 1.3,
              invalidateOnRefresh: true
            }
          });

          joinTl
            .fromTo(lineBold, { x: edgeX(lineBold, -1) }, { x: 0, ease: 'power2.inOut', duration: 1 }, 0)
            .fromTo(lineThin, { x: edgeX(lineThin, 1) }, { x: 0, ease: 'power2.inOut', duration: 1 }, 0);

          if (ctaRest.length) {
            joinTl.fromTo(
              ctaRest,
              { y: 24, opacity: 0 },
              { y: 0, opacity: 1, stagger: 0.08, ease: 'power2.out', duration: 0.25 },
              0.8
            );
          }
        }
      }

      if (footerLower) {
        const footerCols = footerLower.querySelectorAll('.footer-brand, .footer-col, .footer-top-btn');
        if (footerCols.length) {
          gsap.fromTo(
            footerCols,
            { y: 26, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              stagger: 0.08,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: footerLower,
                start: 'top 96%',
                end: 'bottom bottom',
                scrub: 0.5
              }
            }
          );
        }
      }
    }

    // Recalcula gatilhos após ScrollExpand e ScrollStack definirem suas alturas
    ScrollTrigger.refresh();
  }

  initGsapChapters();

  /* =========================================================
     4. MENU MOBILE
  ========================================================= */
  const burger = document.querySelector('.nav-burger');
  const mobileNav = document.getElementById('mobile-nav');

  if (burger && mobileNav) {
    const closeMenu = () => {
      burger.setAttribute('aria-expanded', 'false');
      mobileNav.hidden = true;
    };

    burger.addEventListener('click', () => {
      const expanded = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!expanded));
      mobileNav.hidden = expanded;
    });

    mobileNav.querySelectorAll('a, button').forEach((item) => {
      item.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !mobileNav.hidden) closeMenu();
    });
  }

  /* =========================================================
     5. MAPA INTERATIVO DE POLOS NO BRASIL
  ========================================================= */
  const hubsData = {
    sp:  { x: 387.1, y: 409.4, label: 'SÃO PAULO, SP · PRESENCIAL, HÍBRIDO & ONLINE' },
    fln: { x: 364.4, y: 458.4, label: 'FLORIANÓPOLIS, SC · TRIATLO, CORRIDA & ORLA' },
    cwb: { x: 355.9, y: 432.2, label: 'CURITIBA, PR · FORÇA, CORRIDA & PERFORMANCE' },
    rj:  { x: 427.9, y: 401.7, label: 'RIO DE JANEIRO, RJ · NATAÇÃO, CORRIDA & FUNCIONAL' },
    joi: { x: 360.9, y: 442.7, label: 'JOINVILLE, SC · CORRIDA DE RUA & BASE AERÓBIA' },
    bh:  { x: 418.9, y: 365.5, label: 'BELO HORIZONTE, MG · TRAIL, RUA & PREPARAÇÃO' },
    poa: { x: 332.7, y: 487.8, label: 'PORTO ALEGRE, RS · CICLISMO, PISTA & FORÇA' },
    br:  { x: 371.7, y: 315.6, label: 'TODO O BRASIL · ACOMPANHAMENTO 100% ONLINE & APP' }
  };

  const hubButtons = document.querySelectorAll('.hub-pill');
  const activeBeacon = document.getElementById('active-hub-beacon');
  const hubReadoutText = document.getElementById('hub-readout-text');

  hubButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.hub;
      const hub = hubsData[key];
      if (!hub) return;

      hubButtons.forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

      if (activeBeacon) {
        activeBeacon.setAttribute('transform', `translate(${hub.x}, ${hub.y})`);
      }
      if (hubReadoutText) {
        hubReadoutText.textContent = hub.label;
      }
    });
  });

  /* =========================================================
     6B. FAQ — ACORDEÃO SUAVE (como no vídeo de referência)
         altura anima ao abrir/fechar, "+" gira e vira "×",
         texto entra com fade e só um item fica aberto por vez.
  ========================================================= */
  const faqItems = [...document.querySelectorAll('.faq-item')];
  if (faqItems.length) {
    const setOpen = (item, open, animate = true) => {
      const answer = item.querySelector('.faq-answer');
      const inner = item.querySelector('.faq-answer__inner');
      const g = window.gsap;
      item.classList.toggle('is-open', open);
      if (!answer || !g || reduceMotion || !animate) {
        item.open = open;
        return;
      }
      g.killTweensOf([answer, inner]);
      if (open) {
        item.open = true;
        g.fromTo(answer, { height: 0 }, {
          height: () => inner.offsetHeight,
          duration: 0.6,
          ease: 'power3.inOut',
          clearProps: 'height',
          onComplete: () => window.ScrollTrigger?.refresh()
        });
        g.fromTo(inner, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.18, ease: 'power2.out' });
      } else {
        g.to(inner, { opacity: 0, duration: 0.22, ease: 'power1.out' });
        g.fromTo(answer, { height: answer.offsetHeight }, {
          height: 0,
          duration: 0.5,
          ease: 'power3.inOut',
          onComplete: () => {
            if (!item.classList.contains('is-open')) item.open = false;
            g.set([answer, inner], { clearProps: 'height,opacity,transform' });
            window.ScrollTrigger?.refresh();
          }
        });
      }
    };

    faqItems.forEach((item) => {
      item.classList.toggle('is-open', item.open);
      item.querySelector('.faq-summary')?.addEventListener('click', (e) => {
        e.preventDefault();
        const willOpen = !item.classList.contains('is-open');
        faqItems.forEach((other) => {
          if (other !== item && other.classList.contains('is-open')) setOpen(other, false);
        });
        setOpen(item, willOpen);
      });
    });
  }

  /* =========================================================
     7. MODAL INTERATIVO — PRÉVIA DO MATCH LINKATLETAS
  ========================================================= */
  const goalCopy = {
    'começar': 'Começar com orientação e um plano que respeite seu ponto de partida.',
    'constância': 'Construir uma rotina possível, com acompanhamento ao longo do caminho.',
    'performance': 'Ajustar seus treinos aos seus objetivos e acompanhar a evolução com seu treinador.'
  };

  const modal = document.getElementById('match-modal');
  const closeModalBtn = document.getElementById('match-close');
  const matchForm = document.getElementById('match-form');
  const matchSport = document.getElementById('match-sport');
  const matchResult = document.getElementById('match-result');
  const matchResultCopy = document.getElementById('match-result-copy');

  document.querySelectorAll('[data-open-match]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      if (trigger.tagName === 'A') e.preventDefault();
      if (!modal) return;
      const presetSport = trigger.dataset.sport;
      if (presetSport && matchSport) {
        matchSport.value = presetSport;
      }
      if (matchResult) matchResult.hidden = true;
      modal.showModal();
    });
  });

  closeModalBtn?.addEventListener('click', () => modal?.close());

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });

  matchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(matchForm);
    const sport = String(data.get('sport') || '');
    const goal = String(data.get('goal') || '');
    const format = String(data.get('format') || '');
    if (!sport || !goal || !format) return;

    if (matchResultCopy && matchResult) {
      matchResultCopy.textContent = `${sport} · Acompanhamento ${format.toLowerCase()}. ${goalCopy[goal] || ''}`;
      matchResult.hidden = false;
    }
  });
})();

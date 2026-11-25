import { expect, test, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

// These UI regressions use API fixtures so they run without database or storage services.
async function fixture(page: Page, granted = false) {
  const contract = { id: 'contract-1', athleteId: 'athlete-1', coachId: 'coach-1', athleteName: 'Marina', coachName: 'André Martins', status: 'active', createdAt: new Date().toISOString(), decidedAt: new Date().toISOString() }
  const coaches = [200, 300].map((price) => ({ userId: `coach-${price}`, name: `Treinador ${price}`, city: 'São Paulo', mode: 'online', sports: ['Corrida'], reasons: [], score: 90, price, cref: '123456', bio: 'Treino personalizado' }))
  const workout = { id: 'workout-1', contractId: contract.id, athleteId: contract.athleteId, coachId: contract.coachId, coachName: contract.coachName, title: 'Treino de corrida', sport: 'Corrida', scheduledDate: '2026-10-27', status: 'published', instructions: '', blocks: [], execution: null }
  const state = { granted, failConsent: false, revokeOnUpload: false, uploads: 0, consentWrites: 0, reviewAttempts: [] as Record<string, unknown>[], reviews: [] as Record<string, unknown>[], prices: [] as (string | null)[] }
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api', '')
    const send = (json: unknown, status = 200) => route.fulfill({ status, json })
    if (path === '/auth/session') return send({ user: { id: 'athlete-1', name: 'Marina', email: 'marina@example.com', role: 'athlete' } })
    if (path === '/notifications') return send({ notifications: [], unread: 0 })
    if (path === '/contracts') return send({ contracts: [contract] })
    if (path === '/coaches') {
      const limit = url.searchParams.get('maxPrice')
      state.prices.push(limit)
      return send({ coaches: coaches.filter((c) => limit === null || c.price <= Number(limit)) })
    }
    if (path === '/reviews' && request.method() === 'POST') {
      const body = request.postDataJSON()
      state.reviewAttempts.push(body)
      if (!body.confirmEarly) return send({ code: 'REVIEW_TOO_EARLY', message: 'Ainda não há 7 dias de acompanhamento. Deseja realmente enviar sua avaliação?' }, 403)
      state.reviews.push({ ...body, id: 'review-1', athleteId: 'athlete-1', athleteName: 'Marina', coachName: contract.coachName, createdAt: new Date().toISOString() })
      return send({ review: state.reviews[0] }, 201)
    }
    if (path === '/reviews/review-1' && request.method() === 'PUT') {
      state.reviews[0] = { ...state.reviews[0], ...request.postDataJSON() }
      return send({ review: state.reviews[0] })
    }
    if (path === '/reviews') return send({ reviews: state.reviews, average: state.reviews.length ? Number(state.reviews[0].rating) : 0, count: state.reviews.length })
    if (path === '/workouts') return send({ workouts: [workout] })
    if (path === '/metrics') return send({ metrics: [] })
    if (path === '/privacy/consents') {
      if (request.method() === 'PUT') {
        state.consentWrites++
        if (state.failConsent) return send({ code: 'INTERNAL', message: 'Não foi possível salvar a autorização.' }, 500)
        expect(request.postDataJSON()).toEqual({ purpose: 'performance', granted: true })
        state.granted = true
      }
      return send({ consents: state.granted ? [{ purpose: 'performance', granted: true }] : [] })
    }
    if (path === '/media' && request.method() === 'POST') {
      state.uploads++
      if (!state.granted || state.revokeOnUpload) return send({ code: 'CONSENT_REQUIRED', message: 'Autorize o uso dos dados de performance.' }, 403)
      return send({ media: { id: 'media-1' } }, 201)
    }
    if (path === '/media/uploads' && request.method() === 'POST') {
      expect(state.granted).toBe(true)
      state.uploads++
      return send({ upload: { id: 'upload-1', partSize: 3 * 1024 * 1024, parts: 2 } }, 201)
    }
    if (path === '/media/uploads/upload-1/complete') return send({ media: { id: 'media-1' } }, 201)
    if (path.startsWith('/media/uploads/upload-1/parts/')) return send({ ok: true })
    if (path === '/media') return send({ media: [] })
    return send({})
  })
  return state
}

test('preço máximo filtra imediatamente e volta a mostrar ao aumentar ou limpar', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/atleta/descobrir')
  await expect(page.getByRole('heading', { name: 'Treinador 300' })).toBeVisible()
  const price = page.getByLabel('Preço máximo (R$)', { exact: true })
  await price.fill('200')
  await expect(page.getByRole('heading', { name: 'Treinador 300' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Treinador 200' })).toBeVisible()
  await price.fill('199.99')
  await expect(page.getByText('Nenhum treinador encontrado com esses filtros.', { exact: false })).toBeVisible()
  await price.fill('300')
  await expect(page.getByRole('heading', { name: 'Treinador 300' })).toBeVisible()
  await price.fill('0')
  await expect(page.getByRole('heading', { name: 'Treinador 200' })).toHaveCount(0)
  await price.fill('')
  await expect(page.getByRole('heading', { name: 'Treinador 300' })).toBeVisible()
  expect(state.prices).toContain('199.99')
})

test('avaliação antecipada permite voltar, escapar e publicar apenas ao confirmar', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/atleta/avaliacoes')
  await page.getByLabel('Sua experiência').fill('Ótimas primeiras impressões do acompanhamento.')
  await page.getByRole('radio', { name: '5 de 5, Excelente', exact: true }).click()
  await page.getByRole('button', { name: 'Publicar avaliação' }).click()
  const dialog = page.getByRole('dialog', { name: 'Enviar avaliação antes do prazo?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Ainda não há 7 dias')
  await expect(dialog.getByRole('button', { name: 'Voltar', exact: true })).toBeFocused()
  expect((await new AxeBuilder({ page }).include('.exp-review-confirmation').analyze()).violations).toEqual([])
  await page.screenshot({ path: test.info().outputPath('early-review-confirmation.png') })
  await dialog.getByRole('button', { name: 'Voltar', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByLabel('Sua experiência')).toHaveValue('Ótimas primeiras impressões do acompanhamento.')
  expect(state.reviews).toHaveLength(0)
  await page.getByRole('button', { name: 'Publicar avaliação' }).click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button', { name: 'Publicar avaliação' }).click()
  await dialog.getByRole('button', { name: 'Enviar mesmo assim' }).click()
  await expect(page.getByText('Avaliação salva.', { exact: true })).toBeVisible()
  await expect(dialog).not.toBeVisible()
  expect(state.reviews).toHaveLength(1)
  expect(state.reviewAttempts.map((r) => r.confirmEarly)).toEqual([false, false, false, true])
})

test('estrelas mostram prévia e preservam a nota ao publicar e editar', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/atleta/avaliacoes')
  const rating = page.getByRole('radiogroup', { name: 'Nota', exact: true })
  const stars = rating.getByRole('radio')
  await expect(stars).toHaveCount(5)
  await expect(rating.locator('[aria-checked="true"]')).toHaveCount(0)
  await expect(rating.locator('[data-lit="true"]')).toHaveCount(0)
  await stars.nth(2).hover()
  await expect(rating.locator('[data-lit="true"]')).toHaveCount(3)
  await expect(rating.locator('.peek-rating__tip')).toHaveText('Bom')
  await expect(rating.locator('[aria-checked="true"]')).toHaveCount(0)
  await page.getByRole('heading', { name: 'Compartilhe sua experiência' }).hover()
  await expect(rating.locator('[data-lit="true"]')).toHaveCount(0)
  await stars.nth(2).click()
  await stars.nth(2).click()
  await expect(stars.nth(2)).toHaveAttribute('aria-checked', 'true')
  expect(state.reviewAttempts).toHaveLength(0)
  await page.getByLabel('Sua experiência').fill('Acompanhamento atencioso e muito bem organizado.')
  await page.getByRole('button', { name: 'Publicar avaliação' }).click()
  await page.getByRole('button', { name: 'Enviar mesmo assim' }).click()
  await expect(page.getByText('Avaliação salva.', { exact: true })).toBeVisible()
  expect(state.reviews[0].rating).toBe(3)
  await expect(rating.locator('[aria-checked="true"]')).toHaveCount(0)
  await expect(rating.locator('[data-lit="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Editar avaliação' }).click()
  await expect(stars.nth(2)).toHaveAttribute('aria-checked', 'true')
  await stars.nth(2).focus()
  await page.keyboard.press('ArrowLeft')
  await page.getByRole('button', { name: 'Salvar edição' }).click()
  await expect(page.getByText('Avaliação salva.', { exact: true })).toBeVisible()
  expect(state.reviews[0].rating).toBe(2)
})

test('estrelas aceitam teclado sem zerar a nota nem enviar o formulário', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/atleta/avaliacoes')
  const rating = page.getByRole('radiogroup', { name: 'Nota', exact: true })
  const stars = rating.getByRole('radio')
  await page.getByLabel('Sua experiência').fill('Um acompanhamento muito bom até agora.')
  await page.getByRole('button', { name: 'Publicar avaliação' }).click()
  await expect(page.getByRole('alert')).toContainText('Escolha uma nota de 1 a 5 estrelas')
  await expect(stars.first()).toBeFocused()
  await expect(rating.locator('[aria-checked="true"]')).toHaveCount(0)
  await page.keyboard.press('ArrowRight')
  await expect(stars.first()).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowLeft')
  await expect(stars.first()).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Space')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Delete')
  await expect(stars.nth(4)).toHaveAttribute('aria-checked', 'true')
  await expect(stars.nth(4)).toHaveAttribute('tabindex', '0')
  await expect(stars.first()).toHaveAttribute('tabindex', '-1')
  expect(state.reviewAttempts).toHaveLength(0)
  expect((await new AxeBuilder({ page }).include('.peek-rating').analyze()).violations).toEqual([])
})

test.describe('estrelas no celular', () => {
  test.use({ viewport: { width: 320, height: 800 }, hasTouch: true, isMobile: true })

  test('toque seleciona a nota e cabe na tela', async ({ page }) => {
    await fixture(page)
    await page.goto('/atleta/avaliacoes')
    const rating = page.getByRole('radiogroup', { name: 'Nota', exact: true })
    await expect(rating.locator('[data-lit="true"]')).toHaveCount(0)
    await rating.getByRole('radio').nth(2).tap()
    await expect(rating.getByRole('radio').nth(2)).toHaveAttribute('aria-checked', 'true')
    await expect(rating.locator('[data-lit="true"]')).toHaveCount(3)
    const bounds = await rating.locator('.peek-rating__row').boundingBox()
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.locator('fieldset').filter({ has: rating }).screenshot({ path: test.info().outputPath('rating-mobile.png') })
  })
})

async function selectVideo(page: Page) {
  await page.goto('/atleta/treino')
  await page.getByRole('button', { name: 'Enviar vídeo/arquivo', exact: true }).click()
  await page.getByLabel('Arquivo privado', { exact: true }).setInputFiles({ name: 'treino.mp4', mimeType: 'video/mp4', buffer: Buffer.from('0000ftypisom') })
}

test('vídeo concede consentimento explícito no próprio envio', async ({ page }) => {
  const state = await fixture(page)
  await selectVideo(page)
  await page.getByRole('button', { name: 'Enviar arquivo', exact: true }).click()
  expect(state.uploads).toBe(0)
  expect(state.consentWrites).toBe(0)
  await page.getByRole('checkbox', { name: /Autorizo o uso dos meus vídeos/ }).check()
  expect((await new AxeBuilder({ page }).include('.exp-upload').analyze()).violations).toEqual([])
  await page.locator('.exp-media').screenshot({ path: test.info().outputPath('video-consent.png') })
  await page.getByRole('button', { name: 'Enviar arquivo', exact: true }).click()
  await expect(page.getByText('Arquivo enviado com sucesso.', { exact: true })).toBeVisible()
  expect(state.granted).toBe(true)
  expect(state.consentWrites).toBe(1)
  expect(state.uploads).toBe(1)
  await expect(page.getByLabel('Arquivo privado', { exact: true })).toHaveValue('')
})

test('falha ao autorizar impede upload e preserva arquivo para tentar novamente', async ({ page }) => {
  const state = await fixture(page)
  state.failConsent = true
  await selectVideo(page)
  await page.getByRole('checkbox', { name: /Autorizo o uso dos meus vídeos/ }).check()
  await page.getByRole('button', { name: 'Enviar arquivo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível salvar a autorização.')
  expect(state.uploads).toBe(0)
  await expect(page.getByLabel('Arquivo privado', { exact: true })).toHaveValue(/treino.mp4/)
  state.failConsent = false
  await page.getByRole('button', { name: 'Enviar arquivo', exact: true }).click()
  await expect(page.getByText('Arquivo enviado com sucesso.', { exact: true })).toBeVisible()
})

test('vídeo maior concede autorização antes de iniciar upload em partes', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/atleta/treino')
  await page.getByRole('button', { name: 'Enviar vídeo/arquivo', exact: true }).click()
  await page.getByLabel('Arquivo privado', { exact: true }).setInputFiles({ name: 'treino.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(4 * 1024 * 1024) })
  await page.getByRole('checkbox', { name: /Autorizo o uso dos meus vídeos/ }).check()
  await page.getByRole('button', { name: 'Enviar arquivo', exact: true }).click()
  await expect(page.getByText('Arquivo enviado com sucesso.', { exact: true })).toBeVisible()
  expect(state.uploads).toBe(1)
  expect(state.consentWrites).toBe(1)
})

test('consentimento existente dispensa nova autorização e revogação volta a solicitá-la', async ({ page }) => {
  const state = await fixture(page, true)
  await selectVideo(page)
  await expect(page.getByRole('button', { name: 'Enviar arquivo', exact: true })).toBeEnabled()
  await expect(page.getByRole('checkbox', { name: /Autorizo o uso dos meus vídeos/ })).toHaveCount(0)
  state.revokeOnUpload = true
  await page.getByRole('button', { name: 'Enviar arquivo', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /Autorizo o uso dos meus vídeos/ })).toBeVisible()
  await expect(page.getByLabel('Arquivo privado', { exact: true })).toHaveValue(/treino.mp4/)
  state.revokeOnUpload = false
  await page.getByRole('checkbox', { name: /Autorizo o uso dos meus vídeos/ }).check()
  await page.getByRole('button', { name: 'Enviar arquivo', exact: true }).click()
  await expect(page.getByText('Arquivo enviado com sucesso.', { exact: true })).toBeVisible()
})

test('mapa ordena treinadores por proximidade e permite buscar e explorar um', async ({ page, context }) => {
  await fixture(page)
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: -22.9123, longitude: -43.1847 })
  await page.route('https://basemaps.cartocdn.com/**', route =>
    route.fulfill({ json: { version: 8, sources: {}, layers: [] } }),
  )
  await page.goto('/atleta/descobrir')
  await expect(page.getByText('Sua localização aproximada').first()).toBeVisible()
  await page.getByRole('button', { name: /Mapa de treinadores/ }).click()
  const map = page.getByRole('dialog', { name: 'Mapa de treinadores' })
  const search = map.getByRole('combobox', { name: 'Buscar treinadores próximos' })
  await search.click()
  const results = map.getByRole('listbox', { name: 'Treinadores próximos' }).getByRole('option')
  await expect(results.first()).toContainText('Lívia Torres')
  await search.fill('triatlo curitiba')
  await expect(results).toHaveCount(1)
  await search.press('Enter')
  await expect(map.locator('.coach-map-picker-button')).toHaveText('Bruno Almeida')
  await search.press('Escape')
  await expect(map).toBeVisible()
  await map.getByRole('button', { name: 'Voltar para descoberta' }).click()
  await expect(map).toHaveCount(0)
})

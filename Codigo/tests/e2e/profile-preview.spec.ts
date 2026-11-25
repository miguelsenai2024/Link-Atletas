import { expect, test, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

async function fixture(page: Page, name = 'Marina Costa', bio = 'Atleta de corrida que encontra evolução na constância e em boas conexões.') {
  const state = { name, bio, count: 2, fail: false, requests: 0 }
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/session') return route.fulfill({ json: { user: { id: 'athlete-1', name, email: 'marina@example.com', role: 'athlete' } } })
    if (path === '/api/profiles/me/preview') {
      state.requests++
      return state.fail
        ? route.fulfill({ status: 503, json: { message: 'Não foi possível carregar o perfil.' } })
        : route.fulfill({ json: { preview: { name: state.name, bio: state.bio, consultedCoaches: state.count } } })
    }
    if (path === '/api/reviews') return route.fulfill({ json: { reviews: [], average: 0, count: 0 } })
    if (path === '/api/contracts') return route.fulfill({ json: { contracts: [] } })
    if (path === '/api/notifications') return route.fulfill({ json: { notifications: [], unread: 0 } })
    return route.fulfill({ json: {} })
  })
  await page.goto('/atleta/avaliacoes')
  return state
}

test('nome no topo abre perfil real, primeira letra e treinadores consultados', async ({ page }) => {
  const state = await fixture(page)
  const trigger = page.getByRole('button', { name: 'Visualizar perfil de Marina Costa' })
  expect(state.requests).toBe(0)
  await trigger.click()
  const card = page.getByRole('dialog', { name: 'Marina Costa', exact: true })
  await expect(card).toBeVisible()
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).opacity)).toBe('1')
  await expect(card).toHaveAttribute('aria-modal', 'false')
  const buttonBounds = await trigger.boundingBox()
  const cardBounds = await card.boundingBox()
  expect(Math.abs(cardBounds!.y - (buttonBounds!.y + buttonBounds!.height + 12))).toBeLessThan(1)
  expect(Math.abs(cardBounds!.x + cardBounds!.width - buttonBounds!.x - buttonBounds!.width)).toBeLessThan(1)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  await expect(card.locator('.profile-preview__avatar')).toHaveText('M')
  await expect(card).toContainText(state.bio)
  await expect(card.locator('.profile-preview__stat')).toContainText('2')
  await expect(card).toContainText('treinadores consultados')
  await expect(card.locator('img')).toHaveCount(0)
  await expect(card.getByRole('button')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Fechar visualização do perfil' })).toBeFocused()
  await card.screenshot({ path: test.info().outputPath('profile-desktop.png') })
  await page.screenshot({ path: test.info().outputPath('profile-anchored-desktop.png') })
  expect((await new AxeBuilder({ page }).include('.profile-preview').analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(card).toHaveCount(0)
  await expect(trigger).toBeFocused()
  state.count = 3
  await trigger.click()
  await expect(card.locator('.profile-preview__stat strong')).toHaveText('3')
  await page.getByRole('button', { name: 'Fechar visualização do perfil' }).click()
  await expect(card).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('perfil cabe no celular, aceita zero consultas e fecha ao clicar fora', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 })
  const state = await fixture(page, 'Érica de Albuquerque', '')
  state.count = 0
  await page.getByRole('button', { name: 'Visualizar perfil de Érica de Albuquerque' }).click()
  const card = page.getByRole('dialog')
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).opacity)).toBe('1')
  await expect(card.locator('.profile-preview__avatar')).toHaveText('É')
  await expect(card.locator('.profile-preview__stat strong')).toHaveText('0')
  await expect(card).toContainText('Atleta na LinkAtletas.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const triggerBounds = await page.getByRole('button', { name: 'Visualizar perfil de Érica de Albuquerque' }).boundingBox()
  const popoverBounds = await card.boundingBox()
  expect(Math.abs(popoverBounds!.y - triggerBounds!.y - triggerBounds!.height - 12)).toBeLessThan(1)
  expect(popoverBounds!.x).toBeGreaterThanOrEqual(0)
  expect(popoverBounds!.x + popoverBounds!.width).toBeLessThanOrEqual(320)
  await card.screenshot({ path: test.info().outputPath('profile-mobile.png') })
  expect((await new AxeBuilder({ page }).include('.profile-preview').analyze()).violations).toEqual([])
  await page.mouse.click(2, 2)
  await expect(card).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('popover anima, alterna pelo botão e mantém os controles de fundo disponíveis', async ({ page }) => {
  await fixture(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 600 })
  const trigger = page.getByRole('button', { name: 'Visualizar perfil de Marina Costa' })
  const card = page.locator('.profile-preview')
  await trigger.click()
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).opacity)).toBe('1')
  const bounds = await card.boundingBox()
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(600)
  expect(await card.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  await trigger.click()
  await expect(card).toHaveCount(0)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Principal', exact: true }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Principal', exact: true })).toHaveAttribute('aria-expanded', 'true')
})

test('falha de carregamento permite tentar novamente sem apresentar contagem falsa', async ({ page }) => {
  const state = await fixture(page)
  state.fail = true
  await page.getByRole('button', { name: 'Visualizar perfil de Marina Costa' }).focus()
  await page.keyboard.press('Enter')
  const card = page.getByRole('dialog')
  await expect(card.getByRole('alert')).toHaveText('Não foi possível carregar o perfil.')
  await expect(card.locator('.profile-preview__stat')).toHaveCount(0)
  state.fail = false
  await card.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(card.locator('.profile-preview__stat strong')).toHaveText('2')
  await expect(card.getByRole('alert')).toHaveCount(0)
})

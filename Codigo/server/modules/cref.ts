import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { z } from 'zod'
import { fail } from '../shared/errors.js'

const registryUrl = 'https://www.confef.org.br/registrados/'
const searchUrl = 'https://www.confef.org.br/api/consulta/registrados/datatable'
const states = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '))
const normalizeName = (name: string) =>
  name.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().trim().replace(/\s+/g, ' ')

function normalizeCref(value: string) {
  const match = /^(?:CREF\s+)?(\d{1,6})\s*-?\s*([GP])\s*\/\s*([A-Z]{2})(\s*-\s*S)?$/i.exec(value.trim().toUpperCase())
  if (!match || !states.has(match[3])) return null
  return match[1].padStart(6, '0') + '-' + match[2] + '/' + match[3] + (match[4] ? '-S' : '')
}

const registryResponse = z.object({
  _search: z.string(),
  recordsFiltered: z.int().nonnegative(),
  data: z.array(z.object({ Nome: z.string(), Registro: z.string(), UF: z.string() })),
})

export async function lookupCref(cref: string): Promise<string[]> {
  const endpoint = process.env.CREF_BROWSER_WS_ENDPOINT
  const installedChrome = process.platform === 'win32' && process.env.ProgramFiles
    ? join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe')
    : undefined
  const executablePath = process.env.CREF_BROWSER_EXECUTABLE_PATH ||
    (installedChrome && existsSync(installedChrome) ? installedChrome : undefined)
  const browser = endpoint
    ? await chromium.connectOverCDP(endpoint, { timeout: 10_000 })
    : await chromium.launch({
        headless: true,
        executablePath,
        timeout: 10_000,
      })
  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(15_000)
    page.setDefaultNavigationTimeout(20_000)
    await page.goto(registryUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('#input-busca-registrados').fill(cref)
    const [response] = await Promise.all([
      page.waitForResponse((candidate) =>
        candidate.url() === searchUrl && candidate.request().method() === 'POST'),
      page.locator('#form-busca button').click(),
    ])
    if (!response.ok()) throw new Error('Consulta CONFEF indisponível')
    const result = registryResponse.parse(await response.json())
    if (result._search !== cref || result.recordsFiltered < result.data.length)
      throw new Error('Resposta CONFEF inesperada')

    if (result.recordsFiltered !== result.data.length) return []
    return result.data
      .filter((row) => row.UF === cref.split('/')[1].slice(0, 2) && normalizeCref(row.Registro) === cref)
      .map((row) => row.Nome)
  } finally {
    await browser.close()
  }
}

export async function confirmCref(name: string, value: string, lookup = lookupCref) {
  const cref = normalizeCref(value)
  if (!cref)
    fail(422, 'CREF_INVALID', 'Informe um CREF com UF, como 123456-G/SP.')

  let matches: string[]
  try {
    matches = await lookup(cref)
  } catch {
    fail(503, 'CREF_UNAVAILABLE', 'A consulta ao CONFEF está indisponível. Tente novamente mais tarde.')
  }
  if (matches.length !== 1)
    fail(422, 'CREF_NOT_CONFIRMED', 'Não foi possível confirmar esse CREF na listagem do CONFEF.')
  if (normalizeName(matches[0]) !== normalizeName(name))
    fail(422, 'CREF_NAME_MISMATCH', 'Use o nome completo registrado nesse CREF no CONFEF.')
  return cref
}

import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const textExtensions = new Set(['.html', '.js', '.css', '.json', '.txt', '.map', '.svg'])
const forbidden = [
  ['Supabase service role', /\bservice_role\b|SUPABASE_SERVICE_ROLE_KEY|sb_secret_[A-Za-z0-9_-]+/i],
  ['Resend API key', /RESEND_API_KEY|\bre_[A-Za-z0-9_-]{20,}\b/],
  ['Webhook secret', /ARAUKA_WEBHOOK_SECRET/i],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
]

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  }))
  return nested.flat()
}

const failures = []
for (const path of await files(root)) {
  if (!textExtensions.has(extname(path))) continue
  const content = await readFile(path, 'utf8')
  for (const [label, pattern] of forbidden) {
    if (pattern.test(content)) failures.push(`${label} detectado en ${path}`)
  }
  for (const token of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
      if (payload?.role === 'service_role') failures.push(`JWT service_role detectado en ${path}`)
    } catch {
      // No es un JWT decodificable; las otras reglas siguen aplicando.
    }
  }
}

if (failures.length) {
  console.error('La compilación contiene posibles secretos:\n' + [...new Set(failures)].join('\n'))
  process.exit(1)
}
console.log('Comprobación de secretos en dist: correcta')

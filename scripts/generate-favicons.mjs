#!/usr/bin/env node
/**
 * Generates favicon sizes from public/logo-zupa.png
 * Run: node scripts/generate-favicons.mjs
 */
import { readFile, writeFile } from 'fs/promises'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('Run: npm install --save-dev sharp')
  process.exit(1)
}

const SIZES = [16, 32, 48]
const input = 'public/logo-zupa.png'
const dir = 'public'

const buf = await readFile(input)
for (const size of SIZES) {
  const out = `${dir}/favicon-${size}x${size}.png`
  await sharp(buf).resize(size, size).png().toFile(out)
  console.log('Created', out)
}

// favicon.ico - 32x32 PNG in ICO container (browsers accept this)
const ico32 = await sharp(buf).resize(32, 32).png().toBuffer()
await writeFile(`${dir}/favicon.ico`, ico32)
console.log('Created public/favicon.ico')

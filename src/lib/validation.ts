export function digitsOnly(value: string): string {
  return (value ?? '').replace(/\D/g, '')
}

export function formatUSPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, 10)
  const len = digits.length
  if (!len) return ''
  const area = digits.slice(0, 3)
  const prefix = digits.slice(3, 6)
  const line = digits.slice(6, 10)
  if (len <= 3) return digits
  if (len <= 6) return `(${area}) ${prefix}`
  return `(${area}) ${prefix}-${line}`
}

export function normalizeUSPhone(value: string): string {
  return digitsOnly(value).slice(0, 10)
}

export function isValidUSPhone(value: string): boolean {
  return normalizeUSPhone(value).length === 10
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value: string): string {
  return (value ?? '').trim().toLowerCase()
}

export function isValidEmail(value: string): boolean {
  const normalized = (value ?? '').trim()
  if (!normalized) return false
  return EMAIL_REGEX.test(normalized)
}

type FieldRule = {
  type: 'string' | 'number' | 'boolean' | 'array'
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
}

type Schema = Record<string, FieldRule>

export function validateBody(
  body: Record<string, unknown>,
  schema: Schema
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const [field, rule] of Object.entries(schema)) {
    const value = body[field]

    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`)
      continue
    }
    if (value === undefined || value === null) continue

    if (rule.type === 'string' && typeof value !== 'string') {
      errors.push(`${field} must be a string`)
      continue
    }
    if (rule.type === 'number' && typeof value !== 'number') {
      errors.push(`${field} must be a number`)
      continue
    }
    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength)
        errors.push(`${field} must be at least ${rule.minLength} characters`)
      if (rule.maxLength && value.length > rule.maxLength)
        errors.push(`${field} must be no more than ${rule.maxLength} characters`)
      if (rule.pattern && !rule.pattern.test(value))
        errors.push(`${field} format is invalid`)
    }
    if (rule.type === 'array' && !Array.isArray(value))
      errors.push(`${field} must be an array`)
  }

  return { valid: errors.length === 0, errors }
}

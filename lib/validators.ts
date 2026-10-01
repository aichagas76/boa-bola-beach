// CPF Validation
export function validarCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, '')
  if (nums.length !== 11) return false
  if (/^(\d)\1+$/.test(nums)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(nums[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(nums[9])) return false

  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(nums[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(nums[10])) return false

  return true
}

// Email Validation
export function validarEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

// Phone Validation (Brazilian format)
export function validarCelular(celular: string): boolean {
  const nums = celular.replace(/\D/g, '')
  return nums.length === 11 && /^(\d)\1+$/.test(nums) === false
}

// URL Validation
export function validarURL(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Date Validation
export function validarData(date: string): boolean {
  if (!date) return true
  const d = new Date(date + 'T00:00:00')
  return d instanceof Date && !isNaN(d.getTime())
}

// Future Date Validation
export function validarDataFutura(date: string): boolean {
  if (!date) return true
  const d = new Date(date + 'T00:00:00')
  return d > new Date()
}

// Past Date Validation
export function validarDataPassada(date: string): boolean {
  if (!date) return true
  const d = new Date(date + 'T00:00:00')
  return d < new Date()
}

// Number Validation
export function validarNumero(value: string): boolean {
  return !isNaN(parseFloat(value)) && isFinite(Number(value))
}

// Positive Number Validation
export function validarNumeroPositivo(value: string): boolean {
  return validarNumero(value) && parseFloat(value) > 0
}

// Common validation messages
export const VALIDATION_MESSAGES = {
  required: 'Campo obrigatório',
  cpf: 'CPF inválido',
  email: 'Email inválido',
  celular: 'Celular inválido',
  url: 'URL inválida',
  data: 'Data inválida',
  dataFutura: 'Data deve ser no futuro',
  dataPassada: 'Data deve ser no passado',
  numero: 'Deve ser um número',
  numeroPositivo: 'Deve ser um número positivo',
  minLength: (min: number) => `Mínimo de ${min} caracteres`,
  maxLength: (max: number) => `Máximo de ${max} caracteres`,
}

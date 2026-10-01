import { useState, useCallback } from 'react'

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  validate?: (value: any) => boolean | string
  message?: string
}

export interface ValidationRules {
  [field: string]: ValidationRule | ValidationRule[]
}

export interface ValidationErrors {
  [field: string]: string | null
}

export function useFormValidation(rules: ValidationRules) {
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [touched, setTouched] = useState<{ [field: string]: boolean }>({})

  const validateField = useCallback(
    (fieldName: string, value: any): string | null => {
      const fieldRules = rules[fieldName]
      if (!fieldRules) return null

      const ruleArray = Array.isArray(fieldRules) ? fieldRules : [fieldRules]

      for (const rule of ruleArray) {
        // Validação obrigatória
        if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
          return rule.message || `${fieldName} é obrigatório`
        }

        if (value) {
          // Validação de comprimento mínimo
          if (rule.minLength && value.length < rule.minLength) {
            return rule.message || `Mínimo de ${rule.minLength} caracteres`
          }

          // Validação de comprimento máximo
          if (rule.maxLength && value.length > rule.maxLength) {
            return rule.message || `Máximo de ${rule.maxLength} caracteres`
          }

          // Validação de padrão
          if (rule.pattern && !rule.pattern.test(value)) {
            return rule.message || `Formato inválido`
          }

          // Validação customizada
          if (rule.validate) {
            const result = rule.validate(value)
            if (typeof result === 'string') return result
            if (result === false) return rule.message || `Inválido`
          }
        }
      }

      return null
    },
    [rules]
  )

  const validate = useCallback(
    (formData: { [key: string]: any }): boolean => {
      const newErrors: ValidationErrors = {}

      for (const field in rules) {
        const error = validateField(field, formData[field])
        newErrors[field] = error
      }

      setErrors(newErrors)
      return Object.values(newErrors).every(error => error === null)
    },
    [rules, validateField]
  )

  const validateFieldOnChange = useCallback(
    (fieldName: string, value: any) => {
      const error = validateField(fieldName, value)
      setErrors(prev => ({ ...prev, [fieldName]: error }))
    },
    [validateField]
  )

  const handleBlur = useCallback((fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }))
  }, [])

  const handleChange = useCallback(
    (fieldName: string, value: any) => {
      if (touched[fieldName]) {
        validateFieldOnChange(fieldName, value)
      }
    },
    [touched, validateFieldOnChange]
  )

  const getFieldError = useCallback(
    (fieldName: string): string | null => {
      return touched[fieldName] ? errors[fieldName] : null
    },
    [errors, touched]
  )

  const clearError = useCallback((fieldName: string) => {
    setErrors(prev => ({ ...prev, [fieldName]: null }))
  }, [])

  return {
    errors,
    touched,
    validate,
    validateField,
    validateFieldOnChange,
    handleChange,
    handleBlur,
    getFieldError,
    clearError,
  }
}

interface FormErrorProps {
  error?: string | null
  touched?: boolean
}

export function FormError({ error, touched }: FormErrorProps) {
  if (!error || !touched) return null

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18.101 12.93a.75.75 0 000-1.06l-5.42-5.42a.75.75 0 111.06-1.06l5.42 5.42a.75.75 0 010 1.06zM9.172 5.172a.75.75 0 011.06 0l3.528 3.528a.75.75 0 01-1.06 1.06L9.172 6.232a.75.75 0 010-1.06zm-7.07 7.07a.75.75 0 011.06-1.06l5.42 5.42a.75.75 0 01-1.06 1.06l-5.42-5.42a.75.75 0 010-1.06z" clipRule="evenodd" />
      </svg>
      <span className="text-xs text-red-600 font-medium">{error}</span>
    </div>
  )
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string | null
  touched?: boolean
}

export function FormInput({ label, error, touched, className = '', ...props }: FormInputProps) {
  const hasError = touched && error

  return (
    <div>
      {label && <label className="text-xs text-gray-500 block mb-1">{label}</label>}
      <input
        {...props}
        className={`w-full border rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 ${
          hasError
            ? 'border-red-300 bg-red-50 focus:ring-red-500'
            : 'border-gray-200 focus:ring-[#7DC421]'
        } ${className}`}
      />
      <FormError error={error} touched={touched} />
    </div>
  )
}

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string | null
  touched?: boolean
  children: React.ReactNode
}

export function FormSelect({ label, error, touched, className = '', children, ...props }: FormSelectProps) {
  const hasError = touched && error

  return (
    <div>
      {label && <label className="text-xs text-gray-500 block mb-1">{label}</label>}
      <select
        {...props}
        className={`w-full border rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-1 ${
          hasError
            ? 'border-red-300 bg-red-50 focus:ring-red-500'
            : 'border-gray-200 focus:ring-[#7DC421]'
        } ${className}`}
      >
        {children}
      </select>
      <FormError error={error} touched={touched} />
    </div>
  )
}

import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useRegister } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

// Password strength requirements - MUST match backend validation
// Backend: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/)
const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', test: (pwd: string) => pwd.length >= 8 },
  { label: 'One uppercase letter', test: (pwd: string) => /[A-Z]/.test(pwd) },
  { label: 'One lowercase letter', test: (pwd: string) => /[a-z]/.test(pwd) },
  { label: 'One number', test: (pwd: string) => /[0-9]/.test(pwd) },
]

function RegisterPage() {
  const registerMutation = useRegister()
  const [showSuccess, setShowSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      try {
        await registerMutation.mutateAsync({
          email: value.email,
          password: value.password,
        })
        setRegisteredEmail(value.email)
        setShowSuccess(true)
      } catch (error) {
        console.error('Registration failed:', error)
      }
    },
  })

  // If registration was successful, show success message
  if (showSuccess) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-white">
              Check Your Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-green-900/50 p-4 text-sm text-green-200">
              <p className="font-medium mb-2">Registration successful!</p>
              <p>
                We've sent a confirmation email to <strong>{registeredEmail}</strong>.
                Please check your inbox and click the verification link to activate your account.
              </p>
            </div>
            <p className="text-sm text-gray-400 text-center">
              Didn't receive the email? Check your spam folder or contact support.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-gray-800 pt-4">
            <Link
              to="/login"
              className="font-medium text-blue-400 hover:text-blue-300"
            >
              Return to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-white">
            Create Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
            className="space-y-4"
          >
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Email is required'
                  if (!value.includes('@')) return 'Invalid email address'
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return 'Invalid email format'
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-200">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className={field.state.meta.errors.length ? 'border-red-500' : ''}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-red-400">
                      {field.state.meta.errors.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Password is required'
                  const failedRequirements = PASSWORD_REQUIREMENTS.filter(
                    (req) => !req.test(value)
                  )
                  if (failedRequirements.length > 0) {
                    return 'Password does not meet all requirements'
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-gray-200">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a strong password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className={field.state.meta.errors.length ? 'border-red-500' : ''}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-red-400">
                      {field.state.meta.errors.join(', ')}
                    </p>
                  )}

                  {/* Password strength requirements */}
                  {field.state.value && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-gray-400">Password must contain:</p>
                      {PASSWORD_REQUIREMENTS.map((req, index) => {
                        const isMet = req.test(field.state.value)
                        return (
                          <div
                            key={index}
                            className={`flex items-center gap-2 text-xs ${isMet ? 'text-green-400' : 'text-gray-500'
                              }`}
                          >
                            {isMet ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                            <span>{req.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="confirmPassword"
              validators={{
                onChangeListenTo: ['password'],
                onChange: ({ value, fieldApi }) => {
                  if (!value) return 'Please confirm your password'
                  const password = fieldApi.form.getFieldValue('password')
                  if (value !== password) {
                    return 'Passwords do not match'
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-200">
                    Confirm Password
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter your password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className={field.state.meta.errors.length ? 'border-red-500' : ''}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-red-400">
                      {field.state.meta.errors.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {registerMutation.isError && (
              <div className="rounded-md bg-red-900/50 p-3 text-sm text-red-200">
                {registerMutation.error instanceof Error
                  ? registerMutation.error.message
                  : 'Registration failed. Please try again.'}
              </div>
            )}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isSubmitting || registerMutation.isPending}
                >
                  {isSubmitting || registerMutation.isPending ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-gray-800 pt-4">
          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-blue-400 hover:text-blue-300">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}


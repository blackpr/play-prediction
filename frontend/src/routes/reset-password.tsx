import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useEffect, useState } from 'react'
import { useAuth, useResetPassword } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const [success, setSuccess] = useState(false)
  const resetPasswordMutation = useResetPassword()
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // If we're not authenticated, the link is invalid or session didn't stick.
      // We could redirect to login or show an error.
      // Let's show the error state in the UI instead of immediate redirect for better UX context.
    }
  }, [isLoading, isAuthenticated])

  const form = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      // Manual validation compatible with TanStack Form structure
      if (value.password !== value.confirmPassword) {
        // Validation managed by field level validators mostly
        return
      }

      try {
        await resetPasswordMutation.mutateAsync(value.password)
        setSuccess(true)
        // Redirect after a few seconds?
        setTimeout(() => navigate({ to: '/login' }), 3000)
      } catch (error) {
        console.error('Failed to reset password:', error)
      }
    },
  })

  // Auth check UI
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-900 border-gray-800 border-red-900/50">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-bold text-red-400 mb-2">
              Invalid or Expired Link
            </h3>
            <p className="text-gray-400 mb-4">
              Your password reset session is invalid. Please request a new
              password reset link.
            </p>
            <Link
              to="/forgot-password"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 px-4 transition-colors"
            >
              Request New Link
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-white">
            Set New Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-green-900/30 rounded-lg text-green-200 border border-green-800">
                <p>Your password has been successfully updated.</p>
              </div>
              <p className="text-gray-400 text-sm">Redirecting to login...</p>
              <Link
                to="/login"
                className="inline-block w-full text-center bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 px-4 transition-colors"
              >
                Go to Login
              </Link>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                form.handleSubmit()
              }}
              className="space-y-4"
            >
              <form.Field
                name="password"
                validators={{
                  onChange: ({ value }) => {
                    if (!value) return 'Password is required'
                    if (value.length < 8)
                      return 'Password must be at least 8 characters'
                    if (!/[A-Z]/.test(value))
                      return 'Must contain an uppercase letter'
                    if (!/[a-z]/.test(value))
                      return 'Must contain a lowercase letter'
                    if (!/[0-9]/.test(value)) return 'Must contain a number'
                    return undefined
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-gray-200"
                    >
                      New Password
                    </label>
                    <Input
                      id="password"
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className={
                        field.state.meta.errors.length ? 'border-red-500' : ''
                      }
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
                name="confirmPassword"
                validators={{
                  onChange: ({ value, fieldApi }) => {
                    if (!value) return 'Please confirm your password'
                    // Validating match against other field is tricky in simple form
                    // Usually access form state.
                    if (value !== fieldApi.form.getFieldValue('password')) {
                      return 'Passwords do not match'
                    }
                    return undefined
                  },
                  onBlur: ({ value, fieldApi }) => {
                    if (value !== fieldApi.form.getFieldValue('password')) {
                      return 'Passwords do not match'
                    }
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <label
                      htmlFor="confirmPassword"
                      className="text-sm font-medium text-gray-200"
                    >
                      Confirm Password
                    </label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className={
                        field.state.meta.errors.length ? 'border-red-500' : ''
                      }
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-red-400">
                        {field.state.meta.errors.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              {resetPasswordMutation.isError && (
                <div className="rounded-md bg-red-900/50 p-3 text-sm text-red-200">
                  {resetPasswordMutation.error instanceof Error
                    ? resetPasswordMutation.error.message
                    : 'Failed to update password'}
                </div>
              )}

              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isSubmitting || resetPasswordMutation.isPending}
                  >
                    {isSubmitting || resetPasswordMutation.isPending ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                )}
              </form.Subscribe>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

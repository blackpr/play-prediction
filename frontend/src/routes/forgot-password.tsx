import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useForgotPassword } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [success, setSuccess] = useState(false)
  const forgotPasswordMutation = useForgotPassword()

  const form = useForm({
    defaultValues: {
      email: '',
    },
    onSubmit: async ({ value }) => {
      try {
        await forgotPasswordMutation.mutateAsync(value.email)
        setSuccess(true)
      } catch (error) {
        console.error('Failed to send reset email:', error)
      }
    },
  })

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-white">Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-green-900/30 rounded-lg text-green-200 border border-green-800">
                <p>If an account exists with that email, we've sent instructions to reset your password.</p>
              </div>
              <p className="text-gray-400 text-sm">
                Please check your email inbox and spam folder.
              </p>
              <Link
                to="/login"
                className="inline-block w-full text-center bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 px-4 transition-colors"
              >
                Return to Login
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
              <p className="text-gray-400 text-sm text-center mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form.Field
                name="email"
                validators={{
                  onChange: ({ value }) => {
                    if (!value) return 'Email is required'
                    if (!value.includes('@')) return 'Invalid email address'
                    return undefined
                  }
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
                      className={field.state.meta.errors.length ? "border-red-500" : ""}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-red-400">
                        {field.state.meta.errors.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              {forgotPasswordMutation.isError && (
                <div className="rounded-md bg-red-900/50 p-3 text-sm text-red-200">
                  {forgotPasswordMutation.error instanceof Error ? forgotPasswordMutation.error.message : 'Something went wrong. Please try again.'}
                </div>
              )}

              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isSubmitting || forgotPasswordMutation.isPending}
                  >
                    {isSubmitting || forgotPasswordMutation.isPending ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                )}
              </form.Subscribe>
            </form>
          )}
        </CardContent>
        {!success && (
          <CardFooter className="flex justify-center border-t border-gray-800 pt-4">
            <Link to="/login" className="flex items-center text-sm font-medium text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}

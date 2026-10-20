import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotSchema, type ForgotFormValues } from '../schemas/forgot.schema';
import { useForgotPassword } from '../hooks/useForgotPassword';
import { parseApiError } from '@/lib/error';

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
  });

  const forgot = useForgotPassword();

  const onSubmit = (values: ForgotFormValues) => {
    setServerError(null);
    forgot.mutate(values, {
      onSuccess: () => setDone(true),
      onError: (err) => setServerError(parseApiError(err).message),
    });
  };

  // Success view
  if (done) {
    return (
      <div className="bg-[#151329] border border-[#2d294d] rounded-2xl p-6 text-center space-y-4 shadow-xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-[#9333ea] to-[#ec4899] p-0.5 shadow-lg shadow-purple-500/30 flex items-center justify-center">
          <div className="w-full h-full bg-[#181133] rounded-[14px] flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-white">Check your email</h2>
        <p className="text-sm text-gray-300 leading-relaxed">
          If an account exists with that email, we have sent a secure password reset link.
          <br />
          <span className="text-gray-400 text-xs block mt-2">
            Please check your inbox (and spam folder) to reset your password.
          </span>
        </p>
        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Login</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Server error alert */}
      {serverError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-3 text-sm text-rose-200 flex items-start gap-2.5">
          <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      {/* Email Field */}
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-gray-200 mb-2">
          Email
        </label>
        <div
          className={`flex items-center bg-[#151329] border ${
            errors.email ? 'border-rose-500 ring-1 ring-rose-500/40' : 'border-[#2d294d] focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/30'
          } rounded-2xl px-4 py-3.5 transition-all`}
        >
          {/* Envelope Icon */}
          <svg className="w-5 h-5 text-gray-400 shrink-0 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Email"
            className="w-full bg-transparent border-0 p-0 text-white placeholder-gray-500 text-base outline-none focus:ring-0 focus:outline-none"
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-rose-400 mt-1.5 ml-1">{errors.email.message}</p>
        )}
      </div>

      {/* Send Reset Link Button */}
      <button
        type="submit"
        disabled={forgot.isPending}
        className="w-full h-12 rounded-2xl font-semibold text-white bg-gradient-to-r from-[#d946ef] via-[#8b5cf6] to-[#3b82f6] hover:opacity-95 shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer pt-0.5"
      >
        <span>{forgot.isPending ? 'Sending...' : 'Send Reset Link'}</span>
        {!forgot.isPending && (
          <span className="bg-white/25 rounded-md px-1.5 py-0.5 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        )}
      </button>

      {/* Back to Login Link with left arrow */}
      <div className="text-center pt-2">
        <Link
          to="/login"
          className="inline-flex items-center justify-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Login</span>
        </Link>
      </div>
    </form>
  );
}

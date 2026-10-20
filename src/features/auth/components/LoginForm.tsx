import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { loginSchema, type LoginFormValues } from '../schemas/login.schema';
import { useLogin } from '../hooks/useLogin';
import { parseApiError } from '@/lib/error';

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const login = useLogin();

  const onSubmit = (values: LoginFormValues) => {
    setServerError(null);
    login.mutate(values, {
      onError: (err) => {
        setServerError(parseApiError(err).message);
      },
    });
  };

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

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-gray-200 mb-2">
          Password
        </label>
        <div
          className={`flex items-center bg-[#151329] border ${
            errors.password ? 'border-rose-500 ring-1 ring-rose-500/40' : 'border-[#2d294d] focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/30'
          } rounded-2xl px-4 py-3.5 transition-all`}
        >
          {/* Padlock Icon */}
          <svg className="w-5 h-5 text-gray-400 shrink-0 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Password"
            className="w-full bg-transparent border-0 p-0 text-white placeholder-gray-500 text-base outline-none focus:ring-0 focus:outline-none"
            {...register('password')}
          />
          {/* Show / Hide Eye Button */}
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="text-gray-400 hover:text-white transition-colors ml-2 p-1 focus:outline-none cursor-pointer"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-rose-400 mt-1.5 ml-1">{errors.password.message}</p>
        )}
      </div>

      {/* Login Button */}
      <button
        type="submit"
        disabled={login.isPending}
        className="w-full h-12 rounded-2xl font-semibold text-white bg-gradient-to-r from-[#d946ef] via-[#8b5cf6] to-[#3b82f6] hover:opacity-95 shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer pt-0.5"
      >
        <span>{login.isPending ? 'Logging in...' : 'Login'}</span>
        {!login.isPending && (
          <span className="bg-white/25 rounded-md px-1.5 py-0.5 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        )}
      </button>

      {/* Action Links */}
      <div className="flex items-center justify-between text-xs sm:text-sm pt-2 text-[#94a3b8]">
        <Link
          to="/register"
          className="text-gray-300 hover:text-white underline underline-offset-4 decoration-gray-500 hover:decoration-white transition-colors"
        >
          You don’t have account? Register
        </Link>
        <Link
          to="/forgot-password"
          className="text-gray-300 hover:text-white underline underline-offset-4 decoration-gray-500 hover:decoration-white transition-colors"
        >
          Forgot Password?
        </Link>
      </div>
    </form>
  );
}

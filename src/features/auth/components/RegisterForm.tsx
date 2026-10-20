import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { registerSchema, type RegisterFormValues } from '../schemas/register.schema';
import { useRegister } from '../hooks/useRegister';
import { parseApiError } from '@/lib/error';

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  });

  const registerMutation = useRegister();

  // Watch password in real-time to update the checklist
  const password = watch('password') || '';

  const passwordRules = [
    {
      id: 'length',
      label: '8 characters or more',
      met: password.length >= 8,
    },
    {
      id: 'uppercase',
      label: 'At least 1 uppercase letter',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: 'At least 1 lowercase letter',
      met: /[a-z]/.test(password),
    },
    {
      id: 'number',
      label: 'At least 1 number',
      met: /[0-9]/.test(password),
    },
    {
      id: 'special',
      label: 'At least 1 special character',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const onSubmit = (values: RegisterFormValues) => {
    setServerError(null);
    setSuccessMessage(null);
    registerMutation.mutate(values, {
      onSuccess: (data) => setSuccessMessage(data.message || 'Registration successful!'),
      onError: (err) => setServerError(parseApiError(err).message),
    });
  };

  // Success view after sending verification email
  if (successMessage) {
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
          {successMessage}
          <br />
          <span className="text-gray-400 text-xs block mt-2">
            Please check your inbox (including the spam folder) for the verification link.
          </span>
        </p>
        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[#d946ef] via-[#8b5cf6] to-[#3b82f6] hover:opacity-95 transition-opacity"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Server error alert */}
      {serverError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-3 text-sm text-rose-200 flex items-start gap-2.5">
          <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      {/* Full Name Field */}
      <div>
        <label htmlFor="fullName" className="block text-sm font-semibold text-gray-200 mb-1.5">
          Full Name
        </label>
        <div
          className={`flex items-center bg-[#151329] border ${
            errors.fullName ? 'border-rose-500 ring-1 ring-rose-500/40' : 'border-[#2d294d] focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/30'
          } rounded-2xl px-4 py-3.5 transition-all`}
        >
          {/* Person / User Icon */}
          <svg className="w-5 h-5 text-gray-400 shrink-0 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Full Name"
            className="w-full bg-transparent border-0 p-0 text-white placeholder-gray-500 text-base outline-none focus:ring-0 focus:outline-none"
            {...register('fullName')}
          />
        </div>
        {errors.fullName && (
          <p className="text-xs text-rose-400 mt-1 ml-1">{errors.fullName.message}</p>
        )}
      </div>

      {/* Email Field */}
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-gray-200 mb-1.5">
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
          <p className="text-xs text-rose-400 mt-1 ml-1">{errors.email.message}</p>
        )}
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-gray-200 mb-1.5">
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
            autoComplete="new-password"
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
          <p className="text-xs text-rose-400 mt-1 ml-1">{errors.password.message}</p>
        )}

        {/* Password Rules Checklist */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs pt-3 pb-1">
          {passwordRules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center gap-2 transition-colors ${
                rule.met ? 'text-gray-200' : 'text-gray-400'
              }`}
            >
              {rule.met ? (
                <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-[#9333ea] to-[#ec4899] flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/40">
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-gray-500/80 shrink-0" />
              )}
              <span className="leading-tight">{rule.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm Password Field */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-200 mb-1.5">
          Confirm Password
        </label>
        <div
          className={`flex items-center bg-[#151329] border ${
            errors.confirmPassword ? 'border-rose-500 ring-1 ring-rose-500/40' : 'border-[#2d294d] focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/30'
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
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Confirm Password"
            className="w-full bg-transparent border-0 p-0 text-white placeholder-gray-500 text-base outline-none focus:ring-0 focus:outline-none"
            {...register('confirmPassword')}
          />
          {/* Show / Hide Eye Button */}
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            className="text-gray-400 hover:text-white transition-colors ml-2 p-1 focus:outline-none cursor-pointer"
          >
            {showConfirmPassword ? (
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
        {errors.confirmPassword && (
          <p className="text-xs text-rose-400 mt-1 ml-1">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Register Button */}
      <button
        type="submit"
        disabled={registerMutation.isPending}
        className="w-full h-12 rounded-2xl font-semibold text-white bg-gradient-to-r from-[#d946ef] via-[#8b5cf6] to-[#3b82f6] hover:opacity-95 shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer pt-0.5 mt-2"
      >
        <span>{registerMutation.isPending ? 'Registering...' : 'Register'}</span>
        {!registerMutation.isPending && (
          <span className="bg-white/25 rounded-md px-1.5 py-0.5 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        )}
      </button>

      {/* Login Link */}
      <div className="text-center text-sm text-[#94a3b8] pt-2">
        <span>Already have an account? </span>
        <Link to="/login" className="font-semibold text-white hover:underline transition-colors">
          Login
        </Link>
      </div>
    </form>
  );
}

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetSchema, type ResetFormValues } from '../schemas/reset.schema';
import { useResetPassword } from '../hooks/useResetPassword';
import { parseApiError } from '@/lib/error';

export function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') || '';

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      token: tokenFromUrl,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (tokenFromUrl) {
      setValue('token', tokenFromUrl);
    }
  }, [tokenFromUrl, setValue]);

  const newPassword = watch('newPassword') || '';

  const passwordRules = [
    {
      id: 'length',
      label: '8 characters or more',
      met: newPassword.length >= 8,
    },
    {
      id: 'uppercase',
      label: 'At least 1 uppercase letter',
      met: /[A-Z]/.test(newPassword),
    },
    {
      id: 'lowercase',
      label: 'At least 1 lowercase letter',
      met: /[a-z]/.test(newPassword),
    },
    {
      id: 'number',
      label: 'At least 1 number',
      met: /[0-9]/.test(newPassword),
    },
    {
      id: 'special',
      label: 'At least 1 special character',
      met: /[^A-Za-z0-9]/.test(newPassword),
    },
  ];

  const resetMutation = useResetPassword();

  const onSubmit = (values: ResetFormValues) => {
    setServerError(null);
    resetMutation.mutate(values, {
      onSuccess: () => {
        setDone(true);
        // Automatically return to Login screen after a short delay or via button
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      },
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-white">Password reset successful!</h2>
        <p className="text-sm text-gray-300 leading-relaxed">
          Your password has been reset successfully. Redirecting you to the Login screen...
        </p>
        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[#d946ef] via-[#8b5cf6] to-[#3b82f6] hover:opacity-95 transition-opacity"
          >
            Login Now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Hidden Token input */}
      <input type="hidden" {...register('token')} />

      {/* Warning banner if token is missing */}
      {!tokenFromUrl && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-xs text-amber-200 flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Note: No reset token detected in the URL. Please ensure you open this page from your email reset link.</span>
        </div>
      )}

      {/* Server error alert */}
      {serverError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-3 text-sm text-rose-200 flex items-start gap-2.5">
          <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      {/* New Password Field */}
      <div>
        <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-200 mb-1.5">
          New Password
        </label>
        <div
          className={`flex items-center bg-[#151329] border ${
            errors.newPassword ? 'border-rose-500 ring-1 ring-rose-500/40' : 'border-[#2d294d] focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/30'
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
            id="newPassword"
            type={showNewPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="New Password"
            className="w-full bg-transparent border-0 p-0 text-white placeholder-gray-500 text-base outline-none focus:ring-0 focus:outline-none"
            {...register('newPassword')}
          />
          {/* Show / Hide Eye Button */}
          <button
            type="button"
            onClick={() => setShowNewPassword((prev) => !prev)}
            aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
            className="text-gray-400 hover:text-white transition-colors ml-2 p-1 focus:outline-none cursor-pointer"
          >
            {showNewPassword ? (
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
        {errors.newPassword && (
          <p className="text-xs text-rose-400 mt-1 ml-1">{errors.newPassword.message}</p>
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
        <label htmlFor="confirmNewPassword" className="block text-sm font-semibold text-gray-200 mb-1.5">
          Confirm Password
        </label>
        <div
          className={`flex items-center bg-[#151329] border ${
            errors.confirmNewPassword ? 'border-rose-500 ring-1 ring-rose-500/40' : 'border-[#2d294d] focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/30'
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
            id="confirmNewPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Confirm Password"
            className="w-full bg-transparent border-0 p-0 text-white placeholder-gray-500 text-base outline-none focus:ring-0 focus:outline-none"
            {...register('confirmNewPassword')}
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
        {errors.confirmNewPassword && (
          <p className="text-xs text-rose-400 mt-1 ml-1">{errors.confirmNewPassword.message}</p>
        )}
      </div>

      {/* Reset Password Button */}
      <button
        type="submit"
        disabled={resetMutation.isPending}
        className="w-full h-12 rounded-2xl font-semibold text-white bg-gradient-to-r from-[#d946ef] via-[#8b5cf6] to-[#3b82f6] hover:opacity-95 shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer pt-0.5 mt-2"
      >
        <span>{resetMutation.isPending ? 'Resetting...' : 'Reset Password'}</span>
        {!resetMutation.isPending && (
          <span className="bg-white/25 rounded-md px-1.5 py-0.5 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        )}
      </button>
    </form>
  );
}

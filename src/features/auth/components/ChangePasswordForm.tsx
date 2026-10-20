import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { changePasswordSchema, type ChangePasswordFormValues } from '../schemas/change.schema';
import { useChangePassword } from '../hooks/useChangePassword';
import { useAuthContext } from '@/contexts/AuthContext';
import { parseApiError } from '@/lib/error';

/* ─── Eye Icon (visible) ─── */
function EyeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

/* ─── Eye-off Icon (hidden) ─── */
function EyeOffIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
    </svg>
  );
}

/* ─── Lock Icon ─── */
function LockIcon() {
  return (
    <svg className="w-5 h-5 text-gray-400 shrink-0 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

/* ─── PasswordField helper ─── */
interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
  hasError: boolean;
  errorMessage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registration: any;
}

function PasswordField({
  id, label, placeholder, show, onToggle, hasError, errorMessage, registration,
}: PasswordFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-gray-200 mb-1.5">
        {label}
      </label>
      <div
        className={`flex items-center bg-[#151329] border ${
          hasError
            ? 'border-rose-500 ring-1 ring-rose-500/40'
            : 'border-[#2d294d] focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/30'
        } rounded-2xl px-4 py-3.5 transition-all`}
      >
        <LockIcon />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={id === 'oldPassword' ? 'current-password' : 'new-password'}
          placeholder={placeholder}
          className="w-full bg-transparent border-0 p-0 text-white placeholder-gray-500 text-base outline-none focus:ring-0 focus:outline-none"
          {...registration}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
          className="text-gray-400 hover:text-white transition-colors ml-2 p-1 focus:outline-none cursor-pointer"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hasError && errorMessage && (
        <p className="text-xs text-rose-400 mt-1.5 ml-1">{errorMessage}</p>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export function ChangePasswordForm() {
  const { logout } = useAuthContext();
  const navigate = useNavigate();

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onChange',
  });

  const newPassword = watch('newPassword') || '';

  const passwordRules = [
    { id: 'length',    label: '8 characters or more',        met: newPassword.length >= 8 },
    { id: 'uppercase', label: 'At least 1 uppercase letter',  met: /[A-Z]/.test(newPassword) },
    { id: 'lowercase', label: 'At least 1 lowercase letter',  met: /[a-z]/.test(newPassword) },
    { id: 'number',    label: 'At least 1 number',            met: /[0-9]/.test(newPassword) },
    { id: 'special',   label: 'At least 1 special character', met: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const changeMutation = useChangePassword();

  const onSubmit = (values: ChangePasswordFormValues) => {
    setServerError(null);
    changeMutation.mutate(values, {
      onSuccess: () => {
        setSuccess(true);
        reset();
        let count = 3;
        const timer = setInterval(() => {
          count -= 1;
          setCountdown(count);
          if (count <= 0) {
            clearInterval(timer);
            logout();
            navigate('/login', { replace: true });
          }
        }, 1000);
      },
      onError: (err) => setServerError(parseApiError(err).message),
    });
  };

  /* ── Success View ── */
  if (success) {
    return (
      <div className="bg-[#151329] border border-[#2d294d] rounded-2xl p-8 text-center space-y-5 shadow-xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#9333ea] to-[#ec4899] p-0.5 shadow-lg shadow-purple-500/30 flex items-center justify-center">
          <div className="w-full h-full bg-[#181133] rounded-[14px] flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-white">Password Changed!</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            Your password has been updated successfully.
          </p>
        </div>

        <div className="bg-[#0e0b20] rounded-xl p-3.5 border border-[#2d294d] space-y-2">
          <p className="text-xs text-gray-400">
            Redirecting to login in{' '}
            <span className="text-purple-400 font-semibold">{countdown}s</span>
            {' '}for security.
          </p>
          <div className="h-1 bg-[#2d294d] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#d946ef] to-[#8b5cf6] rounded-full transition-all duration-1000"
              style={{ width: `${((3 - countdown) / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── Form View ── */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Server error alert */}
      {serverError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-3 text-sm text-rose-200 flex items-start gap-2.5">
          <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      {/* ── Section: Current Password ── */}
      <div className="rounded-2xl border border-[#2d294d] bg-[#0e0b20]/50 px-4 pt-3.5 pb-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          Current Password
        </p>
        <PasswordField
          id="oldPassword"
          label="Current Password"
          placeholder="Enter your current password"
          show={showOldPassword}
          onToggle={() => setShowOldPassword((p) => !p)}
          hasError={!!errors.oldPassword}
          errorMessage={errors.oldPassword?.message}
          registration={register('oldPassword')}
        />
      </div>

      {/* ── Section: New Password ── */}
      <div className="rounded-2xl border border-[#2d294d] bg-[#0e0b20]/50 px-4 pt-3.5 pb-4 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          New Password
        </p>

        {/* New Password field with strength checklist */}
        <div>
          <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-200 mb-1.5">
            New Password
          </label>
          <div
            className={`flex items-center bg-[#151329] border ${
              errors.newPassword
                ? 'border-rose-500 ring-1 ring-rose-500/40'
                : 'border-[#2d294d] focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/30'
            } rounded-2xl px-4 py-3.5 transition-all`}
          >
            <LockIcon />
            <input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a new password"
              className="w-full bg-transparent border-0 p-0 text-white placeholder-gray-500 text-base outline-none focus:ring-0 focus:outline-none"
              {...register('newPassword')}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((p) => !p)}
              aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              className="text-gray-400 hover:text-white transition-colors ml-2 p-1 focus:outline-none cursor-pointer"
            >
              {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.newPassword && (
            <p className="text-xs text-rose-400 mt-1.5 ml-1">{errors.newPassword.message}</p>
          )}

          {/* Strength checklist */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs pt-3 pb-1">
            {passwordRules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center gap-2 transition-colors ${rule.met ? 'text-gray-200' : 'text-gray-500'}`}
              >
                {rule.met ? (
                  <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-[#9333ea] to-[#ec4899] flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/40">
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-gray-600 shrink-0" />
                )}
                <span className="leading-tight">{rule.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Confirm New Password */}
        <PasswordField
          id="confirmNewPassword"
          label="Confirm New Password"
          placeholder="Re-enter your new password"
          show={showConfirmPassword}
          onToggle={() => setShowConfirmPassword((p) => !p)}
          hasError={!!errors.confirmNewPassword}
          errorMessage={errors.confirmNewPassword?.message}
          registration={register('confirmNewPassword')}
        />
      </div>

      {/* ── Submit Button ── */}
      <button
        type="submit"
        disabled={changeMutation.isPending}
        className="w-full h-12 rounded-2xl font-semibold text-white bg-gradient-to-r from-[#d946ef] via-[#8b5cf6] to-[#3b82f6] hover:opacity-95 shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer pt-0.5"
      >
        {changeMutation.isPending ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Changing Password...</span>
          </>
        ) : (
          <>
            <span>Change Password</span>
            <span className="bg-white/25 rounded-md px-1.5 py-0.5 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </>
        )}
      </button>
    </form>
  );
}


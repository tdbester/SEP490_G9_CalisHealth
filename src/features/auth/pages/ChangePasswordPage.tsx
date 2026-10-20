import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChangePasswordForm } from '../components/ChangePasswordForm';

export function ChangePasswordPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'CalisHealth · Change Password';
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0918] bg-[radial-gradient(ellipse_80%_60%_at_50%_15%,#201744_0%,#0e0b20_50%,#070611_100%)] text-white flex flex-col items-center px-4 py-8 antialiased selection:bg-fuchsia-500/30 selection:text-white">
      {/* Top Bar with Back to Profile */}
      <div className="w-full max-w-[420px] flex items-center justify-start mb-4">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Profile</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-[420px] flex flex-col items-center my-auto">
        {/* Header - Logo */}
        <div className="flex items-center gap-2.5 mb-6 select-none">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#9333ea] to-[#ec4899] p-0.5 shadow-md shadow-purple-900/40 flex items-center justify-center">
            <div className="w-full h-full bg-[#16112d] rounded-[10px] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C8 6 6 9.5 6 13a6 6 0 0 0 12 0c0-3.5-2-7-6-11Z"
                  fill="url(#calis-change-logo-grad)"
                />
                <path
                  d="M8.5 13.5h2.2l1.1-2.5 1.6 4.5 1.6-2.5h1.5"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="calis-change-logo-grad" x1="6" y1="2" x2="18" y2="19" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#f43f5e" />
                    <stop offset="0.5" stopColor="#d946ef" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-white">Calis</span>
            <span className="text-[#ec4899]">Health</span>
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2 text-center">
          Change Password
        </h1>

        {/* Instruction */}
        <p className="text-sm text-gray-400 text-center mb-7 max-w-xs leading-relaxed">
          Create a strong new password for your CalisHealth account.
        </p>

        {/* Form Container */}
        <div className="w-full">
          <ChangePasswordForm />
        </div>

        {/* Bottom Back to Profile Link */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Profile</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

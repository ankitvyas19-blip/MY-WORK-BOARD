import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

interface LoginGateProps {
  onSuccess: (token: string) => void;
  permanentUrl: string;
}

export const LoginGate: React.FC<LoginGateProps> = ({
  onSuccess,
  permanentUrl,
}) => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate with server or fallback locally
      let valid = false;
      let token = `cj_session_${Date.now()}`;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginId, password }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          valid = true;
          token = data.token;
        } else {
          valid = false;
          setError(data.error || 'Invalid Login ID or Password');
        }
      } catch {
        // Local fallback check
        if (loginId.trim() === '1234' && password.trim() === '4321') {
          valid = true;
        } else {
          setError('Invalid Login ID or Password. Expected 1234 / 4321.');
        }
      }

      if (valid) {
        if (rememberMe) {
          localStorage.setItem('cj_auth_token', token);
          localStorage.setItem('cj_auth_user', JSON.stringify({ loginId: '1234' }));
        } else {
          sessionStorage.setItem('cj_auth_token', token);
        }
        onSuccess(token);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setLoginId('1234');
    setPassword('4321');
    setError(null);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(permanentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen w-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4 select-none relative overflow-hidden">
      {/* Subtle Background Grid Accent */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, #CBD5E1 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white shadow-md mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            CanvasJam Whiteboard
          </h1>
          <p className="text-xs text-slate-500">
            Real-time collaborative brainstorming & infinite canvas
          </p>
        </div>

        {/* Security Login Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl p-6 sm:p-7 space-y-5 backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Protected Workspace Access</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Sign in with your credentials to access the whiteboard
              </p>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title="Click to auto-fill 1234 / 4321"
            >
              <Sparkles className="w-3 h-3" />
              <span>Fill Credentials</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 leading-snug">
                {error}
              </div>
            )}

            {/* Login ID */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Login ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Enter Login ID (1234)"
                  required
                  autoFocus
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pl-9 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password (4321)"
                  required
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pl-9 pr-9 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="p-1 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Keep me signed in on this system</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Access Whiteboard</span>
                </>
              )}
            </button>
          </form>

          {/* Credentials Info Helper */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-600 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800">Assigned Credentials: </span>
              <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold">1234</span>
              <span className="mx-1">/</span>
              <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold">4321</span>
            </div>
          </div>
        </div>

        {/* Permanent URL & Any-System Share Card */}
        <div className="bg-white/80 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-700 font-bold">
            <span className="flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
              <span>Permanent Web Link</span>
            </span>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
              Hosted & Live
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Use this permanent link on any laptop, desktop, tablet, or phone. Simply enter Login ID <strong className="text-slate-800">1234</strong> and Password <strong className="text-slate-800">4321</strong> to log in.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              readOnly
              value={permanentUrl}
              className="flex-1 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 truncate"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, ShieldCheck, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [user, router]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      console.error('Auth error:', err);
      const firebaseError = err as { code?: string; message?: string };

      if (firebaseError.code === 'auth/user-not-found') {
        setError('Usuario no encontrado. Verifica el email.');
      } else if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
        setError('Contraseña incorrecta.');
      } else if (firebaseError.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado.');
      } else if (firebaseError.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else if (firebaseError.code === 'auth/invalid-email') {
        setError('Email inválido.');
      } else if (firebaseError.code === 'auth/network-request-failed') {
        setError('Sin conexión con Firebase. Verifica tu red e intenta de nuevo.');
      } else {
        setError(`Error: ${err.message || firebaseError.code || 'Error desconocido'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-[100dvh] w-full flex flex-col justify-between overflow-hidden bg-[#fafafa]"
      style={{ fontFamily: "'Manrope', 'Inter', system-ui, -apple-system, sans-serif", WebkitFontSmoothing: "antialiased" }}
    >

      {/* Soft Animated Canvas Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#fdfcfd]">
        {/* Soft Lavender Glow Top Left */}
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-100/60 blur-[120px] mix-blend-multiply opacity-80 animate-[pulse_10s_ease-in-out_infinite]"></div>
        {/* Soft Pink Glow Top Right */}
        <div className="absolute top-[0%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-fuchsia-50/60 blur-[120px] mix-blend-multiply opacity-80"></div>
        {/* Subtle white grounding at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-gradient-to-t from-white to-transparent"></div>
      </div>

      {/* Spacer to push content center */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6 py-16 z-10">

        <div className="relative w-full max-w-[450px] mt-[70px]">

          {/* Logo Section - Absolute Centered Top (Floating Badge) */}
          <div className="absolute -top-[70px] left-1/2 -translate-x-1/2 z-20">
            <div className="relative w-[140px] h-[140px] bg-white rounded-[40px] shadow-[0_15px_35px_rgba(0,0,0,0.06)] flex items-center justify-center border border-white p-3">
              <img
                alt="Logo Urbanity Academy"
                className="w-full h-full object-contain"
                src="/logo.png.jpeg"
              />
            </div>
          </div>

          {/* Glass Card */}
          <div className="w-full bg-white/50 backdrop-blur-[40px] border border-white/80 shadow-[0_20px_60px_rgba(0,0,0,0.04)] rounded-[40px] px-8 sm:px-12 pt-[90px] pb-10">

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6" suppressHydrationWarning>

              {/* Email Field */}
              <div className="space-y-2">
                <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-600 tracking-[0.08em] uppercase ml-1">
                  Email Corporativo
                </label>
                <div className="relative group">
                  {/* Thin, subtle icon */}
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5 transition-colors group-focus-within:text-[#4A245C]" strokeWidth={1.5} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-[52px] pl-14 pr-5 bg-white/70 border border-zinc-200/60 rounded-full text-zinc-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#60356A]/20 focus:border-[#4A245C]/30 transition-all focus:bg-white placeholder:text-zinc-400"
                    placeholder="nombre@empresa.com"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-600 tracking-[0.08em] uppercase ml-1">
                  Contraseña
                </label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5 transition-colors group-focus-within:text-[#4A245C]" strokeWidth={1.5} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-[52px] pl-14 pr-5 bg-white/70 border border-zinc-200/60 rounded-full text-zinc-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#60356A]/20 focus:border-[#4A245C]/30 transition-all tracking-[0.2em] focus:bg-white placeholder:text-zinc-400 placeholder:tracking-normal"
                    placeholder="••••••••••••"
                    required
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-2xl flex items-center justify-center text-center animate-shake border border-red-100">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Primary Action Button */}
              <div className="pt-2 space-y-5">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[56px] bg-gradient-to-r from-[#59306b] to-[#451f66] text-white font-semibold text-[15px] rounded-full shadow-[0_12px_24px_rgba(76,29,149,0.2)] hover:shadow-[0_15px_30px_rgba(76,29,149,0.3)] active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none"
                >
                  {loading ? 'Validando...' : 'Iniciar Sesión'}
                </button>

                <button
                  type="button"
                  className="w-full block text-center text-zinc-600 font-semibold text-[13px] hover:text-zinc-800 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

            </form>
          </div>

          {/* Security Badge directly below the card */}
          <div className="mt-8 flex items-center justify-center gap-2 text-zinc-500 text-[11px] font-medium transition-all">
            <ShieldCheck className="w-[14px] h-[14px]" strokeWidth={2} />
            <span>Acceso Encriptado de Grado Empresarial</span>
          </div>

        </div>

      </div>

      {/* Global Footer matched precisely to image */}
      <footer className="w-full px-6 py-6 border-t border-black/5 md:px-12 z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-[12px] font-medium text-zinc-500 bg-white/30 backdrop-blur-md">
        <div className="font-bold text-[#4C1D95] tracking-tight">PROLEV AI</div>
        <div className="flex items-center gap-6">
        </div>
        <div>© 2026 PROLEV AI. All rights reserved.</div>
      </footer>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
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

  const handleDemoLogin = async (role: 'admin' | 'student') => {
    // Reemplaza estas credenciales con las que uses para pruebas reales.
    const demoEmail = role === 'admin' ? 'admin@urbanity.com' : 'alumno@urbanity.com';
    const demoPassword = 'password123';

    setEmail(demoEmail);
    setPassword(demoPassword);

    setError('');
    setLoading(true);

    try {
      await signIn(demoEmail, demoPassword);
    } catch (err: any) {
      console.error('Demo Auth error:', err);
      const firebaseError = err as { code?: string; message?: string };
      setError(`Error Demo: ${firebaseError.message || firebaseError.code || 'Error desconocido'}`);
    } finally {
      setLoading(false);
      setShowDemoModal(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden font-sans">
      {/* Animated Mesh Gradient Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-500/30 rounded-full blur-[100px] pointer-events-none mix-blend-multiply animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-blue-500/30 rounded-full blur-[100px] pointer-events-none mix-blend-multiply animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
      <div className="absolute top-[40%] left-[20%] w-[30vw] h-[30vw] bg-pink-400/20 rounded-full blur-[80px] pointer-events-none mix-blend-multiply animate-pulse" style={{ animationDuration: '10s', animationDelay: '5s' }} />

      {/* Decorative dot pattern overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

      <div className="w-full max-w-[440px] relative z-10 animate-fade-in-up">
        {/* Glow effect behind the card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-[38px] blur-xl opacity-20 transition-all group-hover:opacity-30"></div>

        <Card className="!rounded-[36px] !bg-white/80 !backdrop-blur-3xl !shadow-[0_24px_60px_-15px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.6)_inset] space-y-8 p-10 relative overflow-hidden" hover={false}>
          {/* Subtle reflection on the card edge */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-[36px]"></div>

          <div className="text-center space-y-5 relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-gradient-to-br from-purple-600 to-blue-600 text-4xl shadow-2xl shadow-purple-500/30 mb-1 transform transition-transform hover:scale-105">
              <span className="drop-shadow-md">🎓</span>
            </div>
            <div className="space-y-1.5">
              <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">
                Mi Talento Urbanity
              </h1>
              <p className="text-gray-500 text-sm font-medium">
                Tu plataforma de crecimiento
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10" suppressHydrationWarning>
            <div className="space-y-4">
              <div className="group relative transition-all">
                <Input
                  id="login-email"
                  label="Correo electrónico"
                  type="email"
                  placeholder="nombre@urbanity.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="!bg-white/60 focus:!bg-white !border-gray-200 focus:!border-purple-500 !rounded-2xl transition-all shadow-sm focus:shadow-md"
                />
              </div>
              <div className="group relative transition-all">
                <Input
                  id="login-password"
                  label="Contraseña"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="!bg-white/60 focus:!bg-white !border-gray-200 focus:!border-purple-500 !rounded-2xl transition-all shadow-sm focus:shadow-md"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-50/80 backdrop-blur-sm border border-red-100/50 text-red-600 text-sm font-medium text-center flex items-center justify-center gap-2 animate-shake">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full !rounded-2xl !py-6 text-base font-semibold !shadow-xl shadow-purple-500/30 active:scale-95 transition-all outline-none focus:ring-4 focus:ring-purple-500/20"
              isLoading={loading}
              style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)', color: 'white' }}
            >
              Iniciar Sesión
            </Button>
          </form>

          {/* Quick Access Demo Button */}
          <div className="mt-8 relative z-10">
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              <span className="relative bg-white/80 backdrop-blur-3xl px-4 text-xs font-semibold text-gray-400 uppercase tracking-widest rounded-full">O probar con</span>
            </div>

            <button
              type="button"
              onClick={() => setShowDemoModal(true)}
              className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl border-2 border-purple-100 bg-purple-50/50 hover:bg-purple-100/50 text-purple-700 font-bold transition-all hover:scale-[1.02] active:scale-95 group"
            >
              <span className="text-xl group-hover:animate-bounce">🚀</span>
              Acceso Rápido (Demo)
            </button>
          </div>

          {/* Minimal Footer */}
          <div className="flex flex-col items-center gap-4 mt-6 opacity-80 relative z-10">
            <p className="text-center text-xs sm:text-sm font-medium flex-col sm:flex-row flex items-center justify-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
              <span className="text-slate-500">Diseñado por</span>
              <span className="font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500 tracking-wide">PROLEV AI</span>
              <span className="hidden sm:inline text-slate-400">·</span>
              <span className="text-slate-500 italic">Ingeniería en Apalancamiento</span>
            </p>
            <div className="flex justify-center gap-6 opacity-60">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 tracking-wider uppercase hover:text-slate-800 transition-colors cursor-pointer">Innovación</span>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 tracking-wider uppercase hover:text-slate-800 transition-colors cursor-pointer">Tecnología</span>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 tracking-wider uppercase hover:text-slate-800 transition-colors cursor-pointer">Apalancamiento</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div
            className="absolute inset-0"
            onClick={() => setShowDemoModal(false)}
          />
          <Card className="relative w-full max-w-sm !rounded-[32px] p-8 shadow-2xl animate-scale-in">
            <button
              onClick={() => setShowDemoModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 mb-4 text-2xl shadow-inner">
                ⚡
              </div>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                Selecciona tu Rol
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Ingresa directamente para probar la plataforma.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => handleDemoLogin('admin')}
                disabled={loading}
                className="w-full relative overflow-hidden group flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-purple-200 bg-white hover:bg-purple-50/50 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-lg">
                    👑
                  </div>
                  <div>
                    <span className="block font-bold text-gray-900 group-hover:text-purple-700 transition-colors">Administrador</span>
                    <span className="block text-xs text-gray-500 font-medium">Acceso total al panel</span>
                  </div>
                </div>
                <div className="text-purple-300 group-hover:text-purple-500 transition-colors relative z-10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
                {/* Hover shine effect */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[shimmer_1s_infinite]"></div>
              </button>

              <button
                onClick={() => handleDemoLogin('student')}
                disabled={loading}
                className="w-full relative overflow-hidden group flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-blue-200 bg-white hover:bg-blue-50/50 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg">
                    🎓
                  </div>
                  <div>
                    <span className="block font-bold text-gray-900 group-hover:text-blue-700 transition-colors">Alumno</span>
                    <span className="block text-xs text-gray-500 font-medium">Vista de formación</span>
                  </div>
                </div>
                <div className="text-blue-300 group-hover:text-blue-500 transition-colors relative z-10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
                {/* Hover shine effect */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[shimmer_1s_infinite]"></div>
              </button>
            </div>

            {loading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-[32px] flex items-center justify-center z-20">
                <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

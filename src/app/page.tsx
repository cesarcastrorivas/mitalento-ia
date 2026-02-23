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
      } else {
        setError(`Error: ${err.message || firebaseError.code || 'Error desconocido'}`);
      }
    } finally {
      setLoading(false);
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

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="space-y-4">
              <div className="group relative transition-all">
                <Input
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

          <div className="relative z-10 pt-4 border-t border-gray-100/50">
            <p className="text-center text-xs text-gray-400 font-medium flex items-center justify-center gap-1.5 opacity-80">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              Protected by Urbanity Secure Auth
            </p>
          </div>
        </Card>

        {/* Minimal Footer */}
        <div className="flex justify-center gap-8 mt-8 opacity-50">
          <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase hover:text-slate-800 transition-colors cursor-pointer">Training</span>
          <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase hover:text-slate-800 transition-colors cursor-pointer">Analytics</span>
          <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase hover:text-slate-800 transition-colors cursor-pointer">AI</span>
        </div>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans" style={{ background: '#F8F9FC' }}>
      {/* Subtle static background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e5ed_1px,transparent_1px)] [background-size:20px_20px] opacity-50 pointer-events-none" />
      {/* Very soft vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_50%,transparent_60%,rgba(209,213,224,0.4)_100%)] pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 animate-fade-in-up">
        <Card
          className="!rounded-3xl !bg-white !shadow-[0_8px_40px_-8px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.06)] space-y-7 p-9 relative overflow-hidden"
          hover={false}
        >
          {/* Subtle top highlight line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />

          {/* Header */}
          <div className="text-center space-y-4 relative z-10">
            <div className="inline-flex items-center justify-center w-18 h-18 w-[72px] h-[72px] rounded-2xl bg-purple-600 text-3xl shadow-lg shadow-purple-600/25 mb-1">
              <span>🎓</span>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Mi Talento Urbanity
              </h1>
              <p className="text-slate-500 text-sm font-normal">
                Tu plataforma de crecimiento
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10" suppressHydrationWarning>
            <div className="space-y-4">
              <div className="transition-all">
                <Input
                  id="login-email"
                  label="Correo electrónico"
                  type="email"
                  placeholder="nombre@urbanity.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="!bg-slate-50 focus:!bg-white !border-slate-200 focus:!border-purple-400 !rounded-xl transition-all focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)]"
                />
              </div>
              <div className="transition-all">
                <Input
                  id="login-password"
                  label="Contraseña"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="!bg-slate-50 focus:!bg-white !border-slate-200 focus:!border-purple-400 !rounded-xl transition-all focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)]"
                />
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium text-center flex items-center justify-center gap-2 animate-shake">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full !rounded-xl !py-5 text-sm font-semibold tracking-wide active:scale-[0.98] transition-all outline-none focus:ring-4 focus:ring-purple-500/20"
              isLoading={loading}
              style={{ background: '#7C3AED', color: 'white', boxShadow: '0 4px 16px -4px rgba(124,58,237,0.4)' }}
            >
              Iniciar Sesión
            </Button>
          </form>

          {/* Footer */}
          <div className="flex flex-col items-center gap-3 pt-1 relative z-10">
            <p className="text-center text-xs font-medium flex items-center justify-center gap-1 text-slate-400">
              <span>Diseñado por</span>
              <span className="font-bold text-slate-700">PROLEV AI</span>
            </p>
            <div className="flex justify-center gap-5">
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase hover:text-slate-600 transition-colors cursor-pointer">Innovación</span>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase hover:text-slate-600 transition-colors cursor-pointer">Tecnología</span>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase hover:text-slate-600 transition-colors cursor-pointer">Apalancamiento</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

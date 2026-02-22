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
  const [displayName, setDisplayName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, register, user } = useAuth();
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
      if (isRegistering) {
        if (!displayName) {
          throw new Error('El nombre es requerido para registrarse.');
        }
        await register(email, password, displayName);
      } else {
        await signIn(email, password);
      }
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F2F2F7] relative overflow-hidden font-sans">
      {/* iOS-like blurred blobs */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-purple-400/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />

      <div className="max-w-sm w-full grid gap-8 relative z-10">
        <div className="text-center space-y-4 mb-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[24px] bg-gradient-to-br from-gray-900 to-gray-800 text-4xl shadow-xl shadow-gray-900/20 mb-2">
            🎓
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Mi Talento Urbanity
            </h1>
            <p className="text-gray-500 text-sm font-medium mt-1">
              Tu plataforma de crecimiento
            </p>
          </div>
        </div>

        <Card className="!rounded-[32px] !bg-white/70 !backdrop-blur-2xl !shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] !border-white/50 space-y-8 p-8" hover={false}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              {isRegistering && (
                <Input
                  label="Nombre completo"
                  type="text"
                  placeholder="Juan Pérez"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              )}
              <Input
                label="Correo electrónico"
                type="email"
                placeholder="nombre@urbanity.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Contraseña"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-50/80 backdrop-blur-sm text-red-600 text-sm font-medium text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full !shadow-lg shadow-primary-500/25 active:scale-95 transition-transform"
              isLoading={loading}
              style={{ background: 'linear-gradient(135deg, var(--primary-700) 0%, var(--primary-900) 100%)', color: 'white' }}
            >
              {isRegistering ? 'Crear cuenta' : 'Iniciar Sesión'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError('');
                }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
              </button>
            </div>
          </form>

          <p className="text-center text-xs text-gray-400 font-medium">
            Protected by Urbanity Secure Auth
          </p>
        </Card>

        {/* Minimal Footer */}
        <div className="flex justify-center gap-6 opacity-60">
          <span className="text-xs font-semibold text-gray-500">Training</span>
          <span className="text-xs font-semibold text-gray-500">Analytics</span>
          <span className="text-xs font-semibold text-gray-500">AI</span>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/50 border border-white/60 backdrop-blur-sm shadow-sm text-center gap-1">
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-medium text-text-secondary">{text}</span>
    </div>
  );
}

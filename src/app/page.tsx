'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BookOpen, AlertCircle } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-container-low font-sans overflow-hidden relative">
      <div className="w-full max-w-[440px] relative z-10 animate-fade-in-up">
        {/* Layering shadow approach via Card premium class */}
        <Card className="card-premium p-10 space-y-10" hover={false}>
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-surface-dim flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-primary" strokeWidth={1.5} />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-label-md text-secondary">Acceso al Sistema</h2>
              <h1 className="text-display-md text-on-surface">Mi Talento</h1>
              <p className="text-body-lg mt-2 px-4">
                Plataforma de crecimiento y excelencia profesional.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6" suppressHydrationWarning>
            <div className="space-y-5">
              <Input
                id="login-email"
                label="Correo electrónico"
                type="email"
                placeholder="nombre@urbanity.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                id="login-password"
                label="Contraseña"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-error/10 text-error text-sm font-medium flex items-start gap-3 animate-shake">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full h-14"
                isLoading={loading}
              >
                Iniciar Sesión
              </Button>
            </div>
          </form>

          {/* Footer */}
          <div className="flex flex-col items-center gap-4 pt-4 border-t border-outline-variant/10">
            <p className="text-center text-xs font-semibold text-outline-variant tracking-wider uppercase">
              Diseñado por PROLEV AI
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

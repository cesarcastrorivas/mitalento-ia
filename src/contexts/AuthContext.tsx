'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import {
    User as FirebaseUser,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db, secondaryAuth } from '@/lib/firebase';
import { User, UserRole } from '@/types';

interface AuthContextType {
    user: User | null;
    firebaseUser: FirebaseUser | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    createUser: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
    register: (email: string, password: string, displayName: string) => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    // Previene que onAuthStateChanged interfiera mientras signIn() está creando la sesión
    const isSigningIn = useRef(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            setFirebaseUser(fbUser);

            if (fbUser) {
                // Si signIn() está en curso, él maneja la sesión — evitar condición de carrera
                if (isSigningIn.current) {
                    setLoading(false);
                    return;
                }

                // Recarga de página: sincronizar un token fresco al servidor
                // Firebase SDK refresca el token automáticamente si está por vencer
                try {
                    const freshToken = await fbUser.getIdToken();
                    const sessionResponse = await fetch('/api/auth/session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: freshToken }),
                    });

                    if (sessionResponse.ok) {
                        const meResponse = await fetch('/api/auth/me');
                        if (meResponse.ok) {
                            setUser(await meResponse.json() as User);
                        } else {
                            await firebaseSignOut(auth);
                            setUser(null);
                        }
                    } else {
                        await firebaseSignOut(auth);
                        setUser(null);
                    }
                } catch {
                    await firebaseSignOut(auth);
                    setUser(null);
                }
            } else {
                setUser(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        isSigningIn.current = true;
        try {
            // 1. Autenticar con Firebase Auth
            const credential = await signInWithEmailAndPassword(auth, email, password);

            // 2. Sincronizar token al servidor (verifyIdToken — no necesita permisos IAM especiales)
            const idToken = await credential.user.getIdToken();
            const sessionResponse = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            });

            if (!sessionResponse.ok) {
                const errBody = await sessionResponse.json().catch(() => ({}));
                await firebaseSignOut(auth);
                throw new Error(errBody.detail || 'Error al crear la sesión. Por favor intenta de nuevo.');
            }

            // 3. Obtener perfil del usuario (rol verificado por Admin SDK)
            const meResponse = await fetch('/api/auth/me');
            if (!meResponse.ok) {
                await firebaseSignOut(auth);
                throw new Error('No se pudo obtener el perfil. Por favor intenta de nuevo.');
            }
            setUser(await meResponse.json() as User);
        } finally {
            isSigningIn.current = false;
        }
    };

    const signOut = async () => {
        await fetch('/api/auth/session', { method: 'DELETE' });
        await firebaseSignOut(auth);
        setUser(null);
    };

    const createUser = async (email: string, password: string, displayName: string, role: UserRole) => {
        // Solo admins pueden crear usuarios
        if (user?.role !== 'admin') {
            throw new Error('No tienes permisos para crear usuarios');
        }

        // Usar secondaryAuth para NO cerrar la sesión del admin
        const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);

        // Crear documento en Firestore (la sesión del admin sigue activa)
        const newUser: User = {
            uid: credential.user.uid,
            email,
            displayName,
            role,
            createdAt: Timestamp.now(),
            createdBy: user.uid,
            isActive: true,
        };

        await setDoc(doc(db, 'users', credential.user.uid), newUser);

        // Cerrar sesión en la instancia secundaria (limpieza)
        await firebaseSignOut(secondaryAuth);
    };

    const register = async (email: string, password: string, displayName: string) => {
        // Registro público (self-registration)
        const credential = await createUserWithEmailAndPassword(auth, email, password);

        // Crear documento en Firestore
        const newUser: User = {
            uid: credential.user.uid,
            email,
            displayName,
            role: 'student', // Por defecto todos son estudiantes
            createdAt: Timestamp.now(),
            createdBy: 'self',
            isActive: true,
        };

        await setDoc(doc(db, 'users', credential.user.uid), newUser);
    };

    const refreshUser = async () => {
        if (!firebaseUser) return;
        try {
            const meResponse = await fetch('/api/auth/me');
            if (meResponse.ok) {
                const userData = await meResponse.json();
                setUser(userData as User);
            }
        } catch (error) {
            console.error('Error refreshing user:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, firebaseUser, loading, signIn, signOut, createUser, register, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

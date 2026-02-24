'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    User as FirebaseUser,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            setFirebaseUser(fbUser);

            if (fbUser) {
                try {
                    // Obtener datos del usuario de Firestore
                    const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
                    if (userDoc.exists()) {
                        setUser({ uid: fbUser.uid, ...userDoc.data() } as User);
                    } else {
                        console.warn('User document does not exist in Firestore, using basic auth profile');
                        setUser({
                            uid: fbUser.uid,
                            email: fbUser.email || '',
                            displayName: fbUser.displayName || 'Usuario',
                            role: 'student', // Default role for safety
                            createdAt: Timestamp.now(),
                            createdBy: 'system',
                            isActive: true
                        });
                    }
                } catch (error: any) {
                    console.error('Error fetching user profile (likely permissions or network):', error);
                    // Fallback para permitir login incluso si Firestore falla
                    setUser({
                        uid: fbUser.uid,
                        email: fbUser.email || '',
                        displayName: fbUser.displayName || 'Usuario (Sin Perfil)',
                        role: 'student', // Asumimos estudiante si falla la lectura
                        createdAt: Timestamp.now(),
                        createdBy: 'system',
                        isActive: true
                    });
                }
            } else {
                setUser(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signOut = async () => {
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
        if (firebaseUser) {
            try {
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                    setUser({ uid: firebaseUser.uid, ...userDoc.data() } as User);
                }
            } catch (error) {
                console.error('Error refreshing user:', error);
            }
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

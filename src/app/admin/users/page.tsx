'use client';

import { useEffect, useState } from 'react';
import {
    collection,
    query,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    Timestamp,
    setDoc,
    where
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, secondaryAuth } from '@/lib/firebase';
import { User, UserRole, LearningPath } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';
import {
    Search,
    Plus,
    Filter,
    Trash2,
    Edit2,
    CheckCircle,
    XCircle,
    Map,
    MoreVertical
} from 'lucide-react';

export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [paths, setPaths] = useState<LearningPath[]>([]);

    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [creating, setCreating] = useState(false);

    // Estado para búsqueda y filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

    // Estado para modal de asignación
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assigningUser, setAssigningUser] = useState<User | null>(null);
    const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        displayName: '',
        role: 'student' as UserRole,
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            // Cargar usuarios
            const usersQ = query(collection(db, 'users'));
            const usersSnapshot = await getDocs(usersQ);
            const usersData = usersSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    uid: doc.id,
                    email: data.email,
                    displayName: data.displayName,
                    role: data.role,
                    createdAt: data.createdAt,
                    isActive: data.isActive,
                    assignedPathIds: data.assignedPathIds
                } as User;
            });
            setUsers(usersData);

            // Cargar rutas activas
            const pathsQ = query(collection(db, 'learning_paths'));
            const pathsSnapshot = await getDocs(pathsQ);
            const pathsData = pathsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as LearningPath));
            setPaths(pathsData);

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        try {
            // Verificar si ya existe un usuario con el mismo correo
            const emailQuery = query(
                collection(db, 'users'),
                where('email', '==', formData.email)
            );
            const emailSnapshot = await getDocs(emailQuery);

            if (!emailSnapshot.empty) {
                const existingUser = emailSnapshot.docs[0].data();
                alert(
                    `⚠️ Ya existe un usuario registrado con este correo.\n\n` +
                    `👤 Nombre: ${existingUser.displayName || 'Sin nombre'}\n` +
                    `📧 Correo: ${existingUser.email}\n` +
                    `🏷️ Rol: ${existingUser.role === 'admin' ? 'Administrador' : 'Estudiante'}\n` +
                    `📊 Estado: ${existingUser.isActive ? 'Activo' : 'Inactivo'}\n\n` +
                    `No se puede crear un usuario duplicado.`
                );
                setCreating(false);
                return;
            }

            // Usar secondaryAuth para NO cerrar la sesión del admin actual
            const credential = await createUserWithEmailAndPassword(
                secondaryAuth,
                formData.email,
                formData.password
            );

            // Crear documento en Firestore (la sesión del admin sigue activa)
            const newUser: User = {
                uid: credential.user.uid,
                email: formData.email,
                displayName: formData.displayName,
                role: formData.role,
                createdAt: Timestamp.now(),
                createdBy: currentUser?.uid,
                isActive: true,
                assignedPathIds: []
            };

            await setDoc(doc(db, 'users', credential.user.uid), newUser);

            // Cerrar sesión en la instancia secundaria (limpieza)
            await signOut(secondaryAuth);

            setShowModal(false);
            setFormData({ email: '', password: '', displayName: '', role: 'student' });
            loadData(); // Recargar todo
        } catch (error: any) {
            console.error('Error creating user:', error);
            alert('Error al crear usuario: ' + (error.message || 'Desconocido'));
        } finally {
            setCreating(false);
        }
    };

    const handleToggleActive = async (user: User) => {
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                isActive: !user.isActive
            });
            // Actualizar localmente para snappiness
            setUsers(users.map(u => u.uid === user.uid ? { ...u, isActive: !u.isActive } : u));
        } catch (error) {
            console.error('Error updating user:', error);
        }
    };

    const handleDelete = async (uid: string) => {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

        try {
            await deleteDoc(doc(db, 'users', uid));
            setUsers(users.filter(u => u.uid !== uid));
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    const handleOpenAssignModal = (user: User) => {
        setAssigningUser(user);
        setSelectedPathIds(user.assignedPathIds || []);
        setShowAssignModal(true);
    };

    const handleSaveAssignments = async () => {
        if (!assigningUser) return;

        try {
            await updateDoc(doc(db, 'users', assigningUser.uid), {
                assignedPathIds: selectedPathIds
            });

            // Actualizar estado local
            setUsers(users.map(u =>
                u.uid === assigningUser.uid
                    ? { ...u, assignedPathIds: selectedPathIds }
                    : u
            ));

            setShowAssignModal(false);
            setAssigningUser(null);
        } catch (error) {
            console.error('Error saving assignments:', error);
            alert('Error al asignar rutas');
        }
    };

    const togglePathSelection = (pathId: string) => {
        if (selectedPathIds.includes(pathId)) {
            setSelectedPathIds(selectedPathIds.filter(id => id !== pathId));
        } else {
            setSelectedPathIds([...selectedPathIds, pathId]);
        }
    };

    // Filtrar usuarios
    const filteredUsers = users.filter(user => {
        const matchesSearch = (user.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1>Gestión de Usuarios</h1>
                    <p>Administra estudiantes y administradores de la plataforma</p>
                </div>
            </header>

            <div className={styles.controls}>
                <div className={styles.searchWrapper}>
                    <Search className={styles.searchIcon} size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o correo..."
                        className={styles.searchInput}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-4">
                    <div className="relative">
                        <select
                            className={styles.filterSelect}
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                        >
                            <option value="all">Todos los roles</option>
                            <option value="student">Estudiantes</option>
                            <option value="admin">Administradores</option>
                        </select>
                    </div>

                    <button onClick={() => setShowModal(true)} className={styles.primaryBtn}>
                        <Plus size={20} />
                        Nuevo Usuario
                    </button>
                </div>
            </div>

            <div className={styles.card}>
                {filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
                        <div className="bg-gray-100 p-4 rounded-full mb-4">
                            <Search size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700">No se encontraron usuarios</h3>
                        <p className="text-sm">Intenta ajustar los filtros o agrega un nuevo usuario.</p>
                    </div>
                ) : (
                    <>
                        <div className={styles.tableHeader}>
                            <span>Usuario</span>
                            <span>Rol</span>
                            <span>Rutas Asignadas</span>
                            <span>Estado</span>
                            <span className="text-right">Acciones</span>
                        </div>
                        <div>
                            {filteredUsers.map((user) => (
                                <div key={user.uid} className={styles.tableRow}>
                                    <div className={styles.userInfo}>
                                        <div className={styles.avatar}>
                                            {user.displayName?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className={styles.userDetails}>
                                            <p className={styles.userName}>{user.displayName}</p>
                                            <p className={styles.userEmail}>{user.email}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <span className={`${styles.badge} ${user.role === 'admin' ? styles.badgeAdmin : styles.badgeStudent}`}>
                                            {user.role === 'admin' ? 'Administrador' : 'Estudiante'}
                                        </span>
                                    </div>

                                    {/* Columna Rutas */}
                                    <div className="text-sm text-gray-500">
                                        {user.role === 'admin' ? (
                                            <span className="italic">Acceso total</span>
                                        ) : (
                                            <span className="font-medium text-gray-700">
                                                {user.assignedPathIds?.length || 0} ruta(s)
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <span className={user.isActive ? styles.badgeActive : styles.badgeInactive}>
                                            <span className={styles.badgeDot}></span>
                                            {user.isActive ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>

                                    <div className={styles.actions}>
                                        {user.role !== 'admin' && (
                                            <button
                                                onClick={() => handleOpenAssignModal(user)}
                                                className={styles.actionBtn}
                                                title="Asignar Rutas"
                                            >
                                                <Map size={18} />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleToggleActive(user)}
                                            className={styles.actionBtn}
                                            title={user.isActive ? 'Desactivar' : 'Activar'}
                                        >
                                            {user.isActive ? <XCircle size={18} /> : <CheckCircle size={18} />}
                                        </button>

                                        {user.uid !== currentUser?.uid && (
                                            <button
                                                onClick={() => handleDelete(user.uid)}
                                                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                                title="Eliminar"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Modal para crear usuario */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Nuevo Usuario</h2>
                            <button onClick={() => setShowModal(false)} className={styles.closeBtn}>
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className={styles.form}>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-gray-700">Nombre completo</label>
                                <input
                                    type="text"
                                    className={styles.searchInput} // Reusing input style
                                    value={formData.displayName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                                    placeholder="Ej: Juan Pérez"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-gray-700">Correo electrónico</label>
                                <input
                                    type="email"
                                    className={styles.searchInput}
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="ejemplo@empresa.com"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-gray-700">Contraseña</label>
                                <input
                                    type="password"
                                    className={styles.searchInput}
                                    value={formData.password}
                                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="Mínimo 6 caracteres"
                                    minLength={6}
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-gray-700">Rol</label>
                                <select
                                    className={styles.filterSelect} // Reusing select style
                                    value={formData.role}
                                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                                    style={{ width: '100%' }}
                                >
                                    <option value="student">Estudiante</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            <div className={styles.formActions}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className={styles.primaryBtn}
                                    disabled={creating}
                                >
                                    {creating ? 'Creando...' : 'Crear Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Asignar Rutas */}
            {showAssignModal && assigningUser && (
                <div className={styles.modalOverlay} onClick={() => setShowAssignModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Asignar Rutas a {assigningUser.displayName}</h2>
                            <button onClick={() => setShowAssignModal(false)} className={styles.closeBtn}>
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="mb-4 text-sm text-gray-500">
                                Selecciona las rutas de aprendizaje asignadas a este usuario:
                            </p>

                            <div className="max-h-60 overflow-y-auto flex flex-col gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                {paths.map(path => (
                                    <label key={path.id} className="flex items-center p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-indigo-200 transition">
                                        <input
                                            type="checkbox"
                                            checked={selectedPathIds.includes(path.id)}
                                            onChange={() => togglePathSelection(path.id)}
                                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                        />
                                        <span className="ml-3 text-xl">{path.icon}</span>
                                        <div className="ml-3">
                                            <strong className="block text-gray-800 text-sm">{path.title}</strong>
                                            <span className={`text-xs ${path.isActive ? 'text-green-600' : 'text-red-500'}`}>
                                                {path.isActive ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                                {paths.length === 0 && (
                                    <p className="text-center text-gray-500 text-sm py-4">No hay rutas creadas en el sistema.</p>
                                )}
                            </div>
                        </div>

                        <div className={styles.formActions} style={{ padding: '0 1.5rem 1.5rem' }}>
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveAssignments}
                                className={styles.primaryBtn}
                            >
                                Guardar Asignaciones
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

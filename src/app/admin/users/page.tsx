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
    MoreVertical,
    UserCircle,
    Mail,
    Lock,
    Shield,
    UserPlus,
    Save,
    AlertTriangle
} from 'lucide-react';

export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [paths, setPaths] = useState<LearningPath[]>([]);

    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [creating, setCreating] = useState(false);

    // States for specialized path assignment
    const [showPathModal, setShowPathModal] = useState(false);
    const [selectedUserPath, setSelectedUserPath] = useState<User | null>(null);
    const [tempAssignedPaths, setTempAssignedPaths] = useState<string[]>([]);
    const [savingPaths, setSavingPaths] = useState(false);

    // Estados para modal de edición
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editFormData, setEditFormData] = useState({
        displayName: '',
        email: '',
        password: '',
        role: 'student' as UserRole,
    });
    const [savingEdit, setSavingEdit] = useState(false);

    // Estado para búsqueda y filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

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

            // Cargar Rutas Dinámicas (Especializadas) de Firestore para el modal
            const pathsQ = query(collection(db, 'learning_paths'));
            const pathsSnapshot = await getDocs(pathsQ);
            const loadedPaths = pathsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as LearningPath));
            setPaths(loadedPaths);
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
                isActive: true
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

    const handleOpenPathModal = (user: User) => {
        setSelectedUserPath(user);
        setTempAssignedPaths(user.assignedPathIds || []);
        setShowPathModal(true);
    };

    const handleTogglePath = (pathId: string) => {
        if (tempAssignedPaths.includes(pathId)) {
            setTempAssignedPaths(tempAssignedPaths.filter(id => id !== pathId));
        } else {
            setTempAssignedPaths([...tempAssignedPaths, pathId]);
        }
    };

    const handleAssignPaths = async () => {
        if (!selectedUserPath) return;

        try {
            setSavingPaths(true);
            await updateDoc(doc(db, 'users', selectedUserPath.uid), {
                assignedPathIds: tempAssignedPaths
            });
            setShowPathModal(false);
            loadData(); // Reload to get updated user list
        } catch (error) {
            console.error('Error assigning paths:', error);
            alert('Error actualizando las rutas: ' + (error as Error).message);
        } finally {
            setSavingPaths(false);
        }
    };

    const handleToggleActive = async (user: User) => {
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                isActive: !user.isActive
            });
            // Actualizar localmente para snappiness
            setUsers(users.map(u => u.uid === user.uid ? { ...u, isActive: !u.isActive } : u));
            // Si estamos en el modal, actualizar también el editingUser
            if (editingUser && editingUser.uid === user.uid) {
                setEditingUser({ ...editingUser, isActive: !editingUser.isActive });
            }
        } catch (error) {
            console.error('Error updating user:', error);
        }
    };

    const handleOpenEditModal = (user: User) => {
        setEditingUser(user);
        setEditFormData({
            displayName: user.displayName || '',
            email: user.email || '',
            password: '',
            role: user.role,
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        try {
            setSavingEdit(true);
            const updateData: Record<string, any> = {
                displayName: editFormData.displayName,
                email: editFormData.email,
                role: editFormData.role,
            };
            // Solo guardar contraseña si se proporcionó una nueva
            if (editFormData.password.trim()) {
                updateData.password = editFormData.password;
            }
            await updateDoc(doc(db, 'users', editingUser.uid), updateData);
            // Actualizar localmente
            setUsers(users.map(u => u.uid === editingUser.uid ? {
                ...u,
                displayName: editFormData.displayName,
                email: editFormData.email,
                role: editFormData.role,
            } : u));
            setShowEditModal(false);
            setEditingUser(null);
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Error al actualizar usuario: ' + (error as Error).message);
        } finally {
            setSavingEdit(false);
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

                    <button
                        onClick={() => {
                            setFormData({ email: '', password: '', displayName: '', role: 'student' });
                            setShowModal(true);
                        }}
                        className={styles.primaryBtn}
                    >
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
                            <span>Acceso</span>
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
                                    <div className="text-sm text-gray-500 flex flex-col items-start gap-1">
                                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                            3 Obligatorias
                                        </span>
                                        {user.assignedPathIds && user.assignedPathIds.length > 0 && (
                                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md mt-1">
                                                +{user.assignedPathIds.length} Especializaciones
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
                                        <button
                                            onClick={() => handleOpenPathModal(user)}
                                            className={styles.actionBtn}
                                            title="Asignar Especializaciones"
                                        >
                                            <Map size={18} />
                                        </button>

                                        <button
                                            onClick={() => handleOpenEditModal(user)}
                                            className={styles.actionBtn}
                                            title="Editar usuario"
                                        >
                                            <Edit2 size={18} />
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
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-slate-900/5 transition-all"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                                    <UserPlus size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">Nuevo Usuario</h2>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">Otorga accesos a la plataforma</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            >
                                <XCircle size={22} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto bg-slate-50/30">
                            <form id="create-user-form" onSubmit={handleCreateUser} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Nombre completo</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <UserCircle size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-sm placeholder:text-slate-400"
                                            value={formData.displayName}
                                            onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                                            placeholder="Ej: Juan Pérez"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Correo electrónico</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <Mail size={18} />
                                        </div>
                                        <input
                                            type="email"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-sm placeholder:text-slate-400"
                                            value={formData.email}
                                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                            placeholder="ejemplo@empresa.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Contraseña</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type="password"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-sm placeholder:text-slate-400"
                                            value={formData.password}
                                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                            placeholder="Mínimo 6 caracteres"
                                            minLength={6}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Rol de Acceso</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <Shield size={18} />
                                        </div>
                                        <select
                                            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-slate-700 shadow-sm appearance-none"
                                            value={formData.role}
                                            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                        >
                                            <option value="student">Estudiante / Usuario</option>
                                            <option value="admin">Administrador del Sistema</option>
                                        </select>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200/50 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="create-user-form"
                                disabled={creating}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-xl transition-all shadow-sm hover:shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {creating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Creando...</span>
                                    </>
                                ) : (
                                    <span>Crear Usuario</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para asignar rutas especializadas */}
            {showPathModal && selectedUserPath && (
                <div className={styles.modalOverlay} onClick={() => setShowPathModal(false)}>
                    <div className={`${styles.modal} max-w-2xl`} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Especializaciones Adicionales</h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    Asignando rutas a <strong>{selectedUserPath.displayName}</strong>
                                </p>
                            </div>
                            <button onClick={() => setShowPathModal(false)} className={styles.closeBtn}>
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
                                <p className="text-sm text-indigo-800 flex items-start gap-2">
                                    <span className="text-lg leading-none">💡</span>
                                    <span>
                                        Este usuario ya cuenta con acceso automático a las <strong>3 rutas obligatorias</strong> del sistema.
                                        Aquí puedes habilitarle acceso a rutas especializadas adicionales.
                                    </span>
                                </p>
                            </div>

                            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                {paths.length === 0 ? (
                                    <div className="text-center p-6 text-slate-500 border border-slate-200 border-dashed rounded-xl">
                                        No hay rutas especializadas disponibles. Créalas desde la vista de "Rutas".
                                    </div>
                                ) : (
                                    paths.map((path) => {
                                        const isAssigned = tempAssignedPaths.includes(path.id);
                                        return (
                                            <div
                                                key={path.id}
                                                className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${isAssigned
                                                    ? 'border-indigo-500 bg-indigo-50/50'
                                                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                                    }`}
                                                onClick={() => handleTogglePath(path.id)}
                                            >
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${isAssigned ? 'bg-indigo-100' : 'bg-slate-100'
                                                    }`}>
                                                    {path.icon || '📚'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`font-semibold ${isAssigned ? 'text-indigo-900' : 'text-slate-900'} truncate`}>
                                                        {path.title}
                                                    </h4>
                                                    <p className={`text-sm ${isAssigned ? 'text-indigo-700/70' : 'text-slate-500'} truncate`}>
                                                        {path.description}
                                                    </p>
                                                </div>
                                                <div className="shrink-0">
                                                    <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${isAssigned
                                                        ? 'bg-indigo-500 border-indigo-500 text-white'
                                                        : 'border-slate-300 bg-white'
                                                        }`}>
                                                        {isAssigned && <CheckCircle size={14} strokeWidth={3} />}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl">
                            <button
                                onClick={() => setShowPathModal(false)}
                                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200/50 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAssignPaths}
                                disabled={savingPaths}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-xl transition-all shadow-sm flex items-center gap-2"
                            >
                                {savingPaths ? 'Guardando...' : 'Guardar Especializaciones'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para editar usuario */}
            {showEditModal && editingUser && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setShowEditModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-slate-900/5 transition-all"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                                    {editingUser.displayName?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">Editar Usuario</h2>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">Modificar datos de {editingUser.displayName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            >
                                <XCircle size={22} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto bg-slate-50/30 space-y-5">
                            {/* Nombre */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Nombre completo</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                        <UserCircle size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-sm placeholder:text-slate-400"
                                        value={editFormData.displayName}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, displayName: e.target.value }))}
                                        placeholder="Nombre del usuario"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Correo electrónico</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-sm placeholder:text-slate-400"
                                        value={editFormData.email}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="correo@ejemplo.com"
                                    />
                                </div>
                            </div>

                            {/* Contraseña */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Nueva contraseña</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none shadow-sm placeholder:text-slate-400"
                                        value={editFormData.password}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, password: e.target.value }))}
                                        placeholder="Dejar vacío para no cambiar"
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1.5 ml-1">Solo completa si deseas cambiar la contraseña actual</p>
                            </div>

                            {/* Rol */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Rol de Acceso</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                        <Shield size={18} />
                                    </div>
                                    <select
                                        className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-slate-700 shadow-sm appearance-none"
                                        value={editFormData.role}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                    >
                                        <option value="student">Estudiante / Usuario</option>
                                        <option value="admin">Administrador del Sistema</option>
                                    </select>
                                </div>
                            </div>

                            {/* Separador */}
                            <div className="border-t border-slate-200 pt-4 mt-2">
                                <div className={`rounded-xl p-4 transition-all ${editingUser.isActive
                                        ? 'bg-amber-50 border border-amber-200'
                                        : 'bg-emerald-50 border border-emerald-200'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${editingUser.isActive
                                                    ? 'bg-amber-100 text-amber-600'
                                                    : 'bg-emerald-100 text-emerald-600'
                                                }`}>
                                                <AlertTriangle size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {editingUser.isActive ? 'Desactivar usuario' : 'Reactivar usuario'}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {editingUser.isActive
                                                        ? 'El alumno no podrá acceder, pero sus datos se conservarán'
                                                        : 'El alumno recuperará el acceso a la plataforma'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleActive(editingUser)}
                                            className={`relative w-12 h-7 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 ${editingUser.isActive
                                                    ? 'bg-emerald-500 focus:ring-emerald-500/20'
                                                    : 'bg-slate-300 focus:ring-slate-300/20'
                                                }`}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${editingUser.isActive ? 'translate-x-5' : 'translate-x-0'
                                                }`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={() => setShowEditModal(false)}
                                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200/50 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-xl transition-all shadow-sm hover:shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {savingEdit ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        <span>Guardar Cambios</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

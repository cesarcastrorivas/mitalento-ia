'use client';

import { useEffect, useState, useRef } from 'react';
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, storage, secondaryAuth } from '@/lib/firebase';
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
    AlertTriangle,
    Camera
} from 'lucide-react';

export default function UsersPage() {
    const { user: currentUser, refreshUser } = useAuth();
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
    const [editPhotoURL, setEditPhotoURL] = useState<string>('');
    const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    // Estado para búsqueda y filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

    // Estado para confirmación de eliminación
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; uid: string; name: string }>({ show: false, uid: '', name: '' });

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
                    assignedPathIds: data.assignedPathIds,
                    photoURL: data.photoURL
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
            if (error.code === 'auth/email-already-in-use') {
                alert(
                    '❌ Error: El correo electrónico ya está registrado en el sistema.\n\n' +
                    'Si eliminaste a este usuario recientemente de la lista, ten en cuenta que su cuenta de acceso (Authentication) aún existe. ' +
                    'Para crear un usuario con este mismo correo, primero debes eliminar la cuenta manualmente desde la consola de Firebase Authentication o desde un backend.\n\n' +
                    'Por favor, utiliza un correo diferente u otra cuenta.'
                );
            } else {
                alert('Error al crear usuario: ' + (error.message || 'Desconocido'));
            }
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
        setEditPhotoURL(user.photoURL || '');
        setShowEditModal(true);
    };

    const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingUser) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona una imagen válida.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen no puede superar 5MB.');
            return;
        }

        setUploadingEditPhoto(true);
        try {
            const storageRef = ref(storage, `avatars/${editingUser.uid}/profile.${file.name.split('.').pop()}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            await updateDoc(doc(db, 'users', editingUser.uid), {
                photoURL: downloadURL,
            });

            setEditPhotoURL(downloadURL);
            setEditingUser({ ...editingUser, photoURL: downloadURL });
            setUsers(users.map(u => u.uid === editingUser.uid ? { ...u, photoURL: downloadURL } : u));

            // Si el admin editó su propia foto, refrescar el contexto para actualizar la navbar
            if (currentUser && editingUser.uid === currentUser.uid) {
                await refreshUser();
            }
        } catch (error: any) {
            console.error('Error uploading photo:', error);
            alert('Error al subir la foto: ' + (error.message || 'Desconocido'));
        } finally {
            setUploadingEditPhoto(false);
        }
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

    const handleDelete = (uid: string) => {
        const userToDelete = users.find(u => u.uid === uid);
        setDeleteConfirm({ show: true, uid, name: userToDelete?.displayName || 'este usuario' });
    };

    const confirmDelete = async () => {
        try {
            // Eliminar usando nuestro backend (API Route) que usa Firebase Admin para borrar también de Authentication
            const response = await fetch(`/api/admin/users/${deleteConfirm.uid}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (!response.ok) {
                // Si falta la key de firebase admin, mostramos el error original
                if (response.status === 500 && result.error?.includes('FIREBASE_PRIVATE_KEY')) {
                    alert('⚠️ Configuración pendiente: Para eliminar la cuenta de Firebase Authentication falta agregar FIREBASE_PRIVATE_KEY y FIREBASE_CLIENT_EMAIL en tu archivo .env.local.\n\nPor ahora, solo se ha borrado de la lista, pero la cuenta aún existe en Firebase. Bórrala manualmente de la consola de Firebase -> Authentication.');
                    // De todas formas lo borramos de UI y de Firestore manual localmente para su conveniencia visual
                    await deleteDoc(doc(db, 'users', deleteConfirm.uid));
                    setUsers(prev => prev.filter(u => u.uid !== deleteConfirm.uid));
                } else {
                    throw new Error(result.error || 'Error al eliminar usuario');
                }
            } else {
                setUsers(prev => prev.filter(u => u.uid !== deleteConfirm.uid));
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Error eliminando: ' + (error as Error).message);
        } finally {
            setDeleteConfirm({ show: false, uid: '', name: '' });
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

            <div className={styles.topBar}>
                <div className={styles.searchWrapper}>
                    <Search className={styles.searchIcon} size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email..."
                        className={styles.searchInput}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className={styles.segmentedControl}>
                    {[
                        { value: 'all', label: 'Todos' },
                        { value: 'student', label: 'Estudiantes' },
                        { value: 'admin', label: 'Administradores' },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            className={`${styles.segmentBtn} ${roleFilter === opt.value ? styles.segmentBtnActive : ''}`}
                            onClick={() => setRoleFilter(opt.value as UserRole | 'all')}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => {
                        setFormData({ email: '', password: '', displayName: '', role: 'student' });
                        setShowModal(true);
                    }}
                    className={styles.primaryBtn}
                >
                    <Plus size={18} />
                    Nuevo Usuario
                </button>
            </div>

            <div className={styles.grid}>
                {filteredUsers.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyStateIcon}>
                            <Search size={28} />
                        </div>
                        <h3 className={styles.emptyStateTitle}>No se encontraron usuarios</h3>
                        <p className={styles.emptyStateText}>Intenta ajustar los filtros o agrega un nuevo usuario.</p>
                    </div>
                ) : (
                    <>
                        {filteredUsers.map((user) => (
                            <div key={user.uid} className={styles.userCard}>
                                <div className={styles.avatarContainer}>
                                    <div className={styles.gridAvatar} style={{ background: user.photoURL ? 'transparent' : '' }}>
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt={user.displayName || ''} />
                                        ) : (
                                            user.displayName?.substring(0, 2).toUpperCase() || '?'
                                        )}
                                    </div>
                                    <div className={`${styles.statusIndicator} ${!user.isActive ? styles.statusInactive : ''}`}></div>
                                </div>

                                <h3 className={styles.cardName}>{user.displayName || 'Usuario Nuevo'}</h3>
                                <p className={styles.cardEmail}>{user.email}</p>

                                <div className={styles.cardBadges}>
                                    <span className={`${styles.badgePill} ${user.role === 'admin' ? styles.badgePillAdmin : styles.badgePillStudent}`}>
                                        {user.role === 'admin' ? 'Admin' : 'Estudiante'}
                                    </span>
                                    {user.isActive ? (
                                        <span className={`${styles.badgePill} ${styles.badgePillAccess}`}>
                                            {user.assignedPathIds && user.assignedPathIds.length > 0 ? `${user.assignedPathIds.length} Cursos` : 'Acceso Total'}
                                        </span>
                                    ) : (
                                        <span className={`${styles.badgePill} ${styles.badgePillInactive}`}>
                                            Inactivo
                                        </span>
                                    )}
                                </div>

                                <div className={styles.cardDivider}></div>

                                <div className={styles.cardFooter}>
                                    <div className={styles.footerActions}>
                                        <button
                                            onClick={() => handleOpenEditModal(user)}
                                            className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
                                            title="Editar usuario"
                                        >
                                            <Edit2 size={16} strokeWidth={2.5} />
                                        </button>
                                        <button
                                            onClick={() => handleOpenPathModal(user)}
                                            className={`${styles.iconBtn} ${styles.iconBtnSecondary}`}
                                            title="Asignar Especializaciones"
                                        >
                                            <Map size={16} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                    {user.uid !== currentUser?.uid && (
                                        <button
                                            onClick={() => handleDelete(user.uid)}
                                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Modal de confirmación de eliminación */}
            {deleteConfirm.show && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setDeleteConfirm({ show: false, uid: '', name: '' })}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24} className="text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">Eliminar usuario</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            ¿Estás seguro de eliminar a <strong>{deleteConfirm.name}</strong>? Esta acción no se puede deshacer.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm({ show: false, uid: '', name: '' })}
                                className="flex-1 px-4 py-2.5 text-slate-600 font-medium bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2.5 text-white font-medium bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                            <div className="flex items-center gap-4">
                                {/* Avatar con opción de cambiar foto */}
                                <div className="relative group">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg overflow-hidden ring-2 ring-white">
                                        {editPhotoURL ? (
                                            <img src={editPhotoURL} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            editingUser.displayName?.charAt(0).toUpperCase() || '?'
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => editFileInputRef.current?.click()}
                                        disabled={uploadingEditPhoto}
                                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg border-2 border-white hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-60"
                                        title="Cambiar foto de perfil"
                                    >
                                        {uploadingEditPhoto ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <Camera size={14} />
                                        )}
                                    </button>
                                    <input
                                        ref={editFileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleEditPhotoUpload}
                                        className="hidden"
                                    />
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
                                    ? 'bg-emerald-50 border border-emerald-200'
                                    : 'bg-amber-50 border border-amber-200'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${editingUser.isActive
                                                ? 'bg-emerald-100 text-emerald-600'
                                                : 'bg-amber-100 text-amber-600'
                                                }`}>
                                                {editingUser.isActive ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {editingUser.isActive ? 'Usuario activo' : 'Usuario inactivo'}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {editingUser.isActive
                                                        ? 'El alumno tiene acceso a la plataforma'
                                                        : 'El alumno no puede acceder, pero sus datos se conservan'
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

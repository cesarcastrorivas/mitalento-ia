import imageCompression from 'browser-image-compression';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
    listAll,
} from 'firebase/storage';
import {
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    doc,
} from 'firebase/firestore';
import { db, storage } from './firebase';
import type { ToolType } from '@/types';

export interface UploadResult {
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    duration?: number;
}

export type UploadProgress = (percent: number) => void;

// Límites por tipo (en MB). Los topes por tipo se enforzan también en storage.rules.
export const TOOL_MAX_MB: Record<Exclude<ToolType, 'script'>, number> = {
    video: 100,
    audio: 20,
    image: 5,
    pdf: 10,
    exe: 500,
};

export const TOOL_ACCEPT: Record<Exclude<ToolType, 'script'>, string> = {
    video: 'video/mp4',
    audio: 'audio/mpeg,audio/mp3',
    image: 'image/jpeg,image/png,image/webp',
    pdf: 'application/pdf',
    exe: 'application/x-msdownload,application/vnd.microsoft.portable-executable,application/octet-stream,.exe',
};

async function readDuration(file: File, kind: 'video' | 'audio'): Promise<number | undefined> {
    return new Promise((resolve) => {
        const el = document.createElement(kind);
        el.preload = 'metadata';
        el.onloadedmetadata = () => {
            const d = el.duration;
            URL.revokeObjectURL(el.src);
            resolve(isFinite(d) ? Math.round(d) : undefined);
        };
        el.onerror = () => resolve(undefined);
        el.src = URL.createObjectURL(file);
    });
}

export async function uploadTool(
    file: File,
    toolId: string,
    type: Exclude<ToolType, 'script'>,
    onProgress?: UploadProgress,
): Promise<UploadResult> {
    let finalFile: File = file;

    // Comprimir imágenes en cliente (~200KB / 1200px)
    if (type === 'image') {
        finalFile = await imageCompression(file, {
            maxSizeMB: 0.2,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
            fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        });
    }

    // Duración para video/audio
    let duration: number | undefined;
    if (type === 'video' || type === 'audio') {
        duration = await readDuration(file, type);
    }

    const safeName = finalFile.name.replace(/[^\w.\-]+/g, '_');
    const path = `tools/${toolId}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, finalFile, {
        contentType: finalFile.type,
    });

    await new Promise<void>((resolve, reject) => {
        task.on(
            'state_changed',
            (snap) => {
                if (onProgress) {
                    onProgress((snap.bytesTransferred / snap.totalBytes) * 100);
                }
            },
            (err) => reject(err),
            () => resolve(),
        );
    });

    const url = await getDownloadURL(task.snapshot.ref);

    return {
        url,
        fileName: file.name,
        fileSize: finalFile.size,
        mimeType: finalFile.type,
        duration,
    };
}

/**
 * Borra todos los archivos en Storage bajo tools/{toolId}/.
 * No falla si la carpeta no existe.
 */
async function deleteToolStorage(toolId: string): Promise<void> {
    try {
        const folderRef = ref(storage, `tools/${toolId}`);
        const listing = await listAll(folderRef);
        await Promise.all(listing.items.map((item) => deleteObject(item).catch(() => null)));
    } catch {
        // Ignorar: orphan file en Storage es aceptable vs doc huérfano.
    }
}

/**
 * Borra una tool: doc en Firestore + su carpeta en Storage.
 */
export async function deleteTool(toolId: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'tools', toolId));
    await batch.commit();
    await deleteToolStorage(toolId);
}

interface CascadeCount {
    folders: number;
    tools: number;
}

/**
 * Preview del borrado en cascada: cuenta folders y tools descendientes.
 */
export async function countCascade(folderId: string): Promise<CascadeCount> {
    const toDelete = { folders: 1, tools: 0 };
    const stack: string[] = [folderId];
    const visited: string[] = [];

    while (stack.length) {
        const current = stack.pop()!;
        visited.push(current);

        // Subfolders
        const subQ = query(collection(db, 'tool_folders'), where('parentId', '==', current));
        const subSnap = await getDocs(subQ);
        subSnap.docs.forEach((d) => {
            stack.push(d.id);
            toDelete.folders += 1;
        });

        // Tools
        const toolsQ = query(
            collection(db, 'tools'),
            where('category', '==', `folder_${current}`),
        );
        const toolsSnap = await getDocs(toolsQ);
        toDelete.tools += toolsSnap.size;
    }

    // visited[0] ya está contado como 1 al inicio
    return { folders: toDelete.folders, tools: toDelete.tools };
}

/**
 * Borrado en cascada: elimina folder, subfolders (recursivo), tools y sus
 * archivos en Storage. Orden: primero Firestore docs, luego Storage
 * (minimiza el peor caso a orphan files en Storage).
 */
export async function deleteFolderCascade(folderId: string): Promise<void> {
    // 1. BFS para recolectar todos los folderIds y toolIds descendientes
    const allFolderIds: string[] = [folderId];
    const allToolIds: string[] = [];
    const stack: string[] = [folderId];

    while (stack.length) {
        const current = stack.pop()!;

        const subQ = query(collection(db, 'tool_folders'), where('parentId', '==', current));
        const subSnap = await getDocs(subQ);
        subSnap.docs.forEach((d) => {
            allFolderIds.push(d.id);
            stack.push(d.id);
        });

        const toolsQ = query(
            collection(db, 'tools'),
            where('category', '==', `folder_${current}`),
        );
        const toolsSnap = await getDocs(toolsQ);
        toolsSnap.docs.forEach((d) => allToolIds.push(d.id));
    }

    // 2. Firestore: batches de 500 ops (límite de writeBatch)
    const all = [
        ...allToolIds.map((id) => ({ col: 'tools', id })),
        ...allFolderIds.map((id) => ({ col: 'tool_folders', id })),
    ];
    for (let i = 0; i < all.length; i += 500) {
        const batch = writeBatch(db);
        for (const { col, id } of all.slice(i, i + 500)) {
            batch.delete(doc(db, col, id));
        }
        await batch.commit();
    }

    // 3. Storage: borrar archivos de cada tool (best-effort)
    await Promise.all(allToolIds.map((id) => deleteToolStorage(id)));
}

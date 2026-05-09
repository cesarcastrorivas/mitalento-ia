import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
// Never cache — each download builds a fresh PDF
export const dynamic = 'force-dynamic';

// A4 landscape in PDF points (72pt/inch)
const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;

// Calibrated for the Urbanity template. Y grows upward from bottom-left.
// The "Otorga el reconocimiento a:" script sits around y≈330; name goes just below it.
const NAME_Y_DEFAULT = 290;
const NAME_MAX_WIDTH = 600;
const NAME_FONT_SIZE_START = 62;
const NAME_FONT_SIZE_MIN = 28;
const NAME_COLOR = rgb(0.90, 0.32, 0.15); // bermellón del modelo (~#E55226)

function sanitizeFilename(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\-_ ]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 60) || 'diploma';
}

async function loadAsset(relativePath: string): Promise<Buffer> {
    const full = path.join(process.cwd(), 'public', relativePath);
    return fs.readFile(full);
}

export async function GET(req: NextRequest) {
    try {
        // ── Auth: admin only ────────────────────────────────────────────
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json(
                { error: 'Tu sesión ha expirado. Recarga la página e inicia sesión nuevamente.' },
                { status: 401 }
            );
        }
        if (user.role !== 'admin') {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        // 30 descargas/hora por admin (anti-scripting)
        const rl = await checkRateLimit(user.uid, 'diplomas-pdf', 30);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Demasiadas descargas. Intenta de nuevo en unos minutos.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } }
            );
        }

        const userId = req.nextUrl.searchParams.get('userId')?.trim();
        if (!userId) {
            return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
        }

        // ── Busca el certificado élite del alumno ───────────────────────
        const db = getAdminDb();
        const certRef = db.collection('certificates').doc(`${userId}_path-elite`);
        const certSnap = await certRef.get();
        if (!certSnap.exists) {
            return NextResponse.json(
                { error: 'Certificado no encontrado. El alumno aún no cumple los requisitos Élite.' },
                { status: 404 }
            );
        }
        const cert = certSnap.data()!;
        if (cert.isActive === false) {
            return NextResponse.json(
                { error: 'Certificado inactivo o revocado.' },
                { status: 410 }
            );
        }

        const userName: string = (cert.userName || '').trim() || 'Asesor Urbanity';
        const verificationCode: string = cert.verificationCode || '';

        // ── Carga assets ────────────────────────────────────────────────
        let templateBytes: Buffer;
        let fontBytes: Buffer;
        try {
            [templateBytes, fontBytes] = await Promise.all([
                loadAsset('diploma-template.png'),
                loadAsset('fonts/Allura-Regular.ttf'),
            ]);
        } catch (err) {
            console.error('Missing diploma asset:', err);
            return NextResponse.json(
                { error: 'Plantilla de diploma no disponible en el servidor. Contacta al administrador.' },
                { status: 500 }
            );
        }

        // ── Genera el PDF ──────────────────────────────────────────────
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        const bg = await pdfDoc.embedPng(templateBytes);
        page.drawImage(bg, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });

        const allura = await pdfDoc.embedFont(fontBytes);

        // Auto-scale para nombres largos
        let size = NAME_FONT_SIZE_START;
        while (
            allura.widthOfTextAtSize(userName, size) > NAME_MAX_WIDTH &&
            size > NAME_FONT_SIZE_MIN
        ) {
            size -= 2;
        }
        const textWidth = allura.widthOfTextAtSize(userName, size);

        page.drawText(userName, {
            x: (PAGE_WIDTH - textWidth) / 2,
            y: NAME_Y_DEFAULT,
            size,
            font: allura,
            color: NAME_COLOR,
        });

        // PDF metadata
        pdfDoc.setTitle(`Diploma Urbanity Academy — ${userName}`);
        pdfDoc.setAuthor('URBANITY ACADEMY');
        pdfDoc.setSubject('Certificado de Reconocimiento Académico');
        pdfDoc.setKeywords(['Urbanity', 'Diploma', 'Élite', verificationCode]);

        const pdfBytes = await pdfDoc.save();

        const filename = `Diploma-${sanitizeFilename(userName)}-${verificationCode || 'URBANITY'}.pdf`;

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        console.error('Error generando diploma PDF:', err);
        return NextResponse.json({ error: 'Error generando el diploma' }, { status: 500 });
    }
}

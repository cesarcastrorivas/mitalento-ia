// Quick standalone test: render the diploma with a sample name to calibrate
// Y-position. Outputs /tmp/diploma-test.pdf. Run: node scripts/test-diploma-render.mjs "Nombre Apellido"
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const NAME_Y_DEFAULT = 290;
const NAME_MAX_WIDTH = 600;
const NAME_FONT_SIZE_START = 62;
const NAME_FONT_SIZE_MIN = 28;
const NAME_COLOR = rgb(0.90, 0.32, 0.15);

const name = process.argv[2] || 'Ana Sofía Valencia';

async function main() {
    const [tpl, font] = await Promise.all([
        fs.readFile(path.join(ROOT, 'public', 'diploma-template.png')),
        fs.readFile(path.join(ROOT, 'public', 'fonts', 'Allura-Regular.ttf')),
    ]);
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const bg = await pdf.embedPng(tpl);
    page.drawImage(bg, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    const allura = await pdf.embedFont(font);

    let size = NAME_FONT_SIZE_START;
    while (allura.widthOfTextAtSize(name, size) > NAME_MAX_WIDTH && size > NAME_FONT_SIZE_MIN) size -= 2;
    const tw = allura.widthOfTextAtSize(name, size);
    page.drawText(name, {
        x: (PAGE_WIDTH - tw) / 2,
        y: NAME_Y_DEFAULT,
        size,
        font: allura,
        color: NAME_COLOR,
    });

    const bytes = await pdf.save();
    const outPath = path.join(ROOT, 'diploma-test-output.pdf');
    await fs.writeFile(outPath, bytes);
    console.log(`OK: wrote ${outPath} (${bytes.length} bytes)`);
    console.log(`  name="${name}" size=${size}pt textWidth=${tw.toFixed(1)}pt y=${NAME_Y_DEFAULT}`);
}
main().catch(err => { console.error(err); process.exit(1); });

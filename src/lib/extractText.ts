import { loadPdfjs, loadMammoth } from './fileExtractorLoader';

let pdfWorkerConfigured = false;

async function extractFromPdf(file: File): Promise<string> {
  const pdfjs = await loadPdfjs();

  if (!pdfWorkerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    pdfWorkerConfigured = true;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    fullText += pageText + '\n\n';
  }
  return fullText;
}

async function extractFromDocx(file: File): Promise<string> {
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractFromTxt(file: File): Promise<string> {
  return file.text();
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return extractFromPdf(file);
  if (name.endsWith('.docx')) return extractFromDocx(file);
  if (name.endsWith('.txt') || name.endsWith('.md')) return extractFromTxt(file);
  throw new Error(`Unsupported file type: ${file.name}. Supported: PDF, DOCX, TXT.`);
}
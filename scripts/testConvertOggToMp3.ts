import fs from 'fs';
import path from 'path';
import { convertOggToMp3 } from '../src/utils/audioConverter';

async function main() {
  try {
    const uploadsDir = path.join(__dirname, '../uploads');

    if (!fs.existsSync(uploadsDir)) {
      console.error('[TestOGG->MP3] ❌ Diretório uploads não encontrado:', uploadsDir);
      process.exit(1);
    }

    const files = fs.readdirSync(uploadsDir).filter((f) => f.toLowerCase().endsWith('.ogg'));

    if (files.length === 0) {
      console.error('[TestOGG->MP3] ❌ Nenhum arquivo .ogg encontrado em uploads. Envie um áudio pelo sistema primeiro.');
      process.exit(1);
    }

    const inputFile = files[0];
    const inputPath = path.join(uploadsDir, inputFile);
    const outputFile = inputFile.replace(/\.ogg$/i, '.mp3');
    const outputPath = path.join(uploadsDir, outputFile);

    console.log('[TestOGG->MP3] 🔍 Arquivo de teste encontrado:', {
      inputFile,
      inputPath,
      outputFile,
      outputPath,
    });

    await convertOggToMp3(inputPath, outputPath);

    console.log('[TestOGG->MP3] ✅ Teste concluído, arquivo MP3 gerado com sucesso.');
  } catch (error: any) {
    console.error('[TestOGG->MP3] ❌ Erro no teste de conversão:', error.message);
    process.exit(1);
  }
}

main();



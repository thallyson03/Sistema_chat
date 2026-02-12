import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Configurar caminho do FFmpeg (Scoop instala em ~/scoop/apps/ffmpeg/current/bin)
const ffmpegPath = path.join(process.env.USERPROFILE || process.env.HOME || '', 'scoop', 'apps', 'ffmpeg', 'current', 'bin', 'ffmpeg.exe');
const ffprobePath = path.join(process.env.USERPROFILE || process.env.HOME || '', 'scoop', 'apps', 'ffmpeg', 'current', 'bin', 'ffprobe.exe');

// Verificar se FFmpeg está disponível
try {
  if (fs.existsSync(ffmpegPath)) {
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log('[AudioConverter] ✅ FFmpeg encontrado em:', ffmpegPath);
  } else {
    // Tentar encontrar no PATH
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      console.log('[AudioConverter] ✅ FFmpeg encontrado no PATH');
    } catch {
      console.warn('[AudioConverter] ⚠️ FFmpeg não encontrado, tentando usar do PATH');
    }
  }
  
  if (fs.existsSync(ffprobePath)) {
    ffmpeg.setFfprobePath(ffprobePath);
  }
} catch (error) {
  console.warn('[AudioConverter] ⚠️ Erro ao configurar FFmpeg:', error);
}

export async function convertWebmToOgg(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      console.log('[AudioConverter] 🔄 Convertendo WEBM para OGG...', {
        input: inputPath,
        output: outputPath,
      });

      const inputSize = fs.statSync(inputPath).size;

      ffmpeg(inputPath)
        .audioCodec('libopus')
        .audioBitrate('64k')
        .audioFrequency(48000)
        .audioChannels(1) // Mono para PTT (push-to-talk)
        .format('ogg')
        .outputOptions([
          '-strict', '-2', // Permitir codecs experimentais se necessário
          '-map_metadata', '-1', // Remover metadados
          '-application', 'voip', // Otimizar para voz (PTT)
          '-compression_level', '10', // Nível de compressão (0-10, 10 = melhor qualidade)
          '-packet_loss', '0', // Sem perda de pacotes
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('[AudioConverter] Comando FFmpeg:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log('[AudioConverter] Progresso:', Math.round(progress.percent) + '%');
          }
        })
        .on('end', () => {
          const outputSize = fs.statSync(outputPath).size;
          
          // Verificar se o arquivo foi criado e tem tamanho válido
          if (outputSize === 0) {
            reject(new Error('Arquivo OGG convertido está vazio'));
            return;
          }
          
          console.log('[AudioConverter] ✅ Conversão concluída:', {
            inputSize,
            outputSize,
            reduction: ((1 - outputSize / inputSize) * 100).toFixed(1) + '%',
            outputPath,
          });
          
          // Verificar se o arquivo existe e é acessível
          if (!fs.existsSync(outputPath)) {
            reject(new Error('Arquivo OGG não foi criado'));
            return;
          }
          
          resolve();
        })
        .on('error', (error: Error) => {
          console.error('[AudioConverter] ❌ Erro ao converter áudio:', error.message);
          reject(new Error(`Erro ao converter WEBM para OGG: ${error.message}`));
        })
        .run();
    } catch (error: any) {
      console.error('[AudioConverter] ❌ Erro ao iniciar conversão:', error.message);
      reject(new Error(`Erro ao converter WEBM para OGG: ${error.message}`));
    }
  });
}


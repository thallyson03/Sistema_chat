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
      console.log('[AudioConverter] 🔄 Convertendo áudio para OGG/Opus...', {
        input: inputPath,
        output: outputPath,
      });

      const inputSize = fs.statSync(inputPath).size;

      ffmpeg(inputPath)
        .audioCodec('libopus')
        .audioBitrate('32k')          // bitrate 32 kbps para voz
        // A documentação da Cloud API usa exemplos com 16 kHz.
        // Mantemos mono + OPUS, mas baixamos a taxa para 16 kHz
        // para ficar o mais próximo possível do perfil padrão de voz.
        .audioFrequency(16000)        // 16 kHz
        .audioChannels(1)             // Mono (PTT)
        .format('ogg')
        .outputOptions([
          '-vbr', 'on',               // variable bitrate
          '-map_metadata', '-1',      // remover metadados
          '-application', 'voip',     // otimizar para voz humana
          '-frame_duration', '20',    // duração de quadro 20ms (perfil comum de voz)
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

/**
 * Converte um áudio OGG (Opus) para MP3 (audio/mpeg).
 * Essa conversão é pensada para compatibilidade máxima com clientes mobile
 * quando usamos a API oficial do WhatsApp.
 */
export async function convertOggToMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      console.log('[AudioConverter] 🔄 Convertendo OGG para MP3...', {
        input: inputPath,
        output: outputPath,
      });

      if (!fs.existsSync(inputPath)) {
        return reject(new Error(`Arquivo de entrada não encontrado: ${inputPath}`));
      }

      const inputSize = fs.statSync(inputPath).size;

      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate('64k')
        .audioChannels(1) // mono é suficiente para voz
        .audioFrequency(44100)
        .format('mp3')
        .outputOptions([
          '-map_metadata', '-1', // remover metadados
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('[AudioConverter] Comando FFmpeg (OGG->MP3):', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log('[AudioConverter] Progresso OGG->MP3:', Math.round(progress.percent) + '%');
          }
        })
        .on('end', () => {
          if (!fs.existsSync(outputPath)) {
            return reject(new Error('Arquivo MP3 não foi criado'));
          }
          const outputSize = fs.statSync(outputPath).size;
          if (outputSize === 0) {
            return reject(new Error('Arquivo MP3 convertido está vazio'));
          }

          console.log('[AudioConverter] ✅ Conversão OGG->MP3 concluída:', {
            inputSize,
            outputSize,
            reduction: ((1 - outputSize / inputSize) * 100).toFixed(1) + '%',
            outputPath,
          });

          resolve();
        })
        .on('error', (error: Error) => {
          console.error('[AudioConverter] ❌ Erro ao converter OGG para MP3:', error.message);
          reject(new Error(`Erro ao converter OGG para MP3: ${error.message}`));
        })
        .run();
    } catch (error: any) {
      console.error('[AudioConverter] ❌ Erro ao iniciar conversão OGG->MP3:', error.message);
      reject(new Error(`Erro ao converter OGG para MP3: ${error.message}`));
    }
  });
}


import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ContactImportService } from '../services/contactImportService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const contactImportService = new ContactImportService();

// Configurar multer para upload de XLSX
const uploadDir = path.join(__dirname, '../../uploads/imports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `contacts-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB (aumentado para Excel)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv (mantido para compatibilidade)
      'text/plain',
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext) || allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos Excel (.xlsx, .xls) ou CSV são permitidos'));
    }
  },
});

export class ContactImportController {
  /**
   * Upload e importação de contatos via CSV
   */
  async importContacts(req: AuthRequest, res: Response) {
    const uploadSingle = upload.single('file');

    uploadSingle(req, res, async (err: any) => {
      if (err) {
        console.error('[ContactImportController] Erro no upload:', err);
        return res.status(400).json({ error: err.message || 'Erro ao fazer upload do arquivo' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const { channelId, listId } = req.body;

      if (!channelId) {
        // Remover arquivo se channelId não foi fornecido
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          // Ignorar erro
        }
        return res.status(400).json({ error: 'channelId é obrigatório' });
      }

      try {
        console.log('[ContactImportController] Iniciando importação:', {
          filename: req.file.originalname,
          channelId,
          listId: listId || 'nenhuma',
          filePath: req.file.path,
        });

        // Validar formato do arquivo
        const validation = contactImportService.validateFileFormat(req.file.path);
        if (!validation.valid) {
          // Remover arquivo se inválido
          try {
            fs.unlinkSync(req.file.path);
          } catch (e) {
            // Ignorar erro
          }
          return res.status(400).json({
            error: validation.message || 'Formato de arquivo inválido',
            columns: validation.columns,
          });
        }

        // Processar importação
        const result = await contactImportService.importFromFile(req.file.path, channelId, listId);

        console.log('[ContactImportController] Importação concluída:', {
          success: result.success,
          errors: result.errors,
          skipped: result.skipped,
        });

        res.json({
          message: 'Importação concluída',
          result: {
            success: result.success,
            errors: result.errors,
            skipped: result.skipped,
            total: result.success + result.errors + result.skipped,
            details: result.details,
          },
        });
      } catch (error: any) {
        console.error('[ContactImportController] Erro ao importar:', error);

        // Remover arquivo em caso de erro
        try {
          if (req.file) {
            fs.unlinkSync(req.file.path);
          }
        } catch (e) {
          // Ignorar erro
        }

        res.status(500).json({
          error: error.message || 'Erro ao processar importação',
        });
      }
    });
  }

  /**
   * Download de template XLSX (já implementado em contactRoutes.ts)
   * Este método está aqui apenas para compatibilidade, mas a rota real está em /api/contacts/template
   */
  async downloadTemplate(req: AuthRequest, res: Response) {
    try {
      // Redirecionar para a rota que já gera XLSX
      res.redirect('/api/contacts/template');
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}



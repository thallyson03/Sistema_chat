import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { readExcelSheetAsJson, readExcelSheetHeaders } from '../utils/excelWorkbook';
import { contactResolutionService } from './contactResolutionService';
import { normalizePhone } from '../utils/phone';

// Importar csv-parse (para compatibilidade com CSV)
// eslint-disable-next-line @typescript-eslint/no-var-requires
let parse: any;
try {
  // Tentar importar csv-parse
  const csvParse = require('csv-parse/sync');
  parse = csvParse.parse || csvParse.default?.parse || csvParse;
} catch (e) {
  // Se não conseguir importar, apenas logar (não é obrigatório se só usar XLSX)
  console.warn('[ContactImport] ⚠️ csv-parse não encontrado. CSV não será suportado, apenas XLSX.');
}

export interface ImportContactRow {
  name: string;
  phone: string;
  email?: string;
  channelId?: string;
}

export interface ImportResult {
  success: number;
  errors: number;
  skipped: number;
  details: Array<{
    row: number;
    contact: string;
    status: 'success' | 'error' | 'skipped';
    message: string;
  }>;
}

export class ContactImportService {
  /**
   * Processa um arquivo Excel ou CSV e importa contatos
   */
  async importFromFile(filePath: string, channelId: string, listId?: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: [],
    };

    try {
      const ext = path.extname(filePath).toLowerCase();
      let records: any[] = [];

      if (ext === '.xlsx') {
        console.log(`[ContactImport] Processando arquivo Excel: ${filePath}`);
        records = await readExcelSheetAsJson(filePath);
        console.log(`[ContactImport] Processando ${records.length} linhas do Excel...`);
      } else if (ext === '.xls') {
        throw new Error(
          'Formato .xls legado não é suportado. Salve o arquivo como .xlsx ou use CSV.',
        );
      } else if (ext === '.csv') {
        // Processar arquivo CSV
        if (!parse) {
          throw new Error('Biblioteca csv-parse não está instalada. Use arquivos Excel (.xlsx) ou instale csv-parse.');
        }
        console.log(`[ContactImport] Processando arquivo CSV: ${filePath}`);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        });
        console.log(`[ContactImport] Processando ${records.length} linhas do CSV...`);
      } else {
        throw new Error(`Formato de arquivo não suportado: ${ext}. Use .xlsx, .xls ou .csv`);
      }

      // Processar cada linha
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNumber = i + 2; // +2 porque linha 1 é cabeçalho e arrays começam em 0

        try {
          // Validar dados obrigatórios
          if (!row.name || !row.phone) {
            result.errors++;
            result.details.push({
              row: rowNumber,
              contact: row.name || row.phone || 'Desconhecido',
              status: 'error',
              message: 'Nome e telefone são obrigatórios',
            });
            continue;
          }

          const normalizedPhone = normalizePhone(String(row.phone));
          if (!normalizedPhone) {
            result.errors++;
            result.details.push({
              row: rowNumber,
              contact: row.name,
              status: 'error',
              message: `Telefone inválido: ${row.phone}`,
            });
            continue;
          }

          const existingContact = await prisma.contact.findUnique({
            where: { phone: normalizedPhone },
          });

          const contact = existingContact
            ? existingContact
            : await contactResolutionService.resolveContactByPhone({
                phone: normalizedPhone,
                name: row.name.trim(),
                channelId,
                externalId: normalizedPhone,
              });

          if (existingContact) {
            await contactResolutionService.upsertChannelIdentity({
              contactId: contact.id,
              channelId,
              externalId: normalizedPhone,
            });
            if (row.email?.trim()) {
              await prisma.contact.update({
                where: { id: contact.id },
                data: { email: row.email.trim() },
              });
            }
            result.skipped++;
            result.details.push({
              row: rowNumber,
              contact: row.name,
              status: 'skipped',
              message: `Contato já existe: ${existingContact.name}`,
            });
            if (!listId) continue;
          }

          // Se listId foi fornecido, adicionar contato à lista
          if (listId) {
            try {
              await prisma.contactListMember.create({
                data: {
                  listId: listId,
                  contactId: contact.id,
                },
              });
              result.details.push({
                row: rowNumber,
                contact: row.name,
                status: 'success',
                message: `Contato criado e adicionado à lista: ${contact.id}`,
              });
            } catch (listError: any) {
              // Se já estiver na lista (unique constraint), apenas logar
              if (listError.code === 'P2002') {
                result.details.push({
                  row: rowNumber,
                  contact: row.name,
                  status: 'success',
                  message: `Contato criado (já estava na lista): ${contact.id}`,
                });
              } else {
                result.details.push({
                  row: rowNumber,
                  contact: row.name,
                  status: 'success',
                  message: `Contato criado (erro ao adicionar à lista): ${contact.id}`,
                });
                console.warn(`[ContactImport] ⚠️ Linha ${rowNumber}: Erro ao adicionar à lista -`, listError.message);
              }
            }
          } else {
            result.details.push({
              row: rowNumber,
              contact: row.name,
              status: 'success',
              message: `Contato criado: ${contact.id}`,
            });
          }

          result.success++;
          console.log(`[ContactImport] ✅ Linha ${rowNumber}: Contato criado - ${row.name} (${normalizedPhone})`);
        } catch (rowError: any) {
          result.errors++;
          result.details.push({
            row: rowNumber,
            contact: row.name || 'Desconhecido',
            status: 'error',
            message: rowError.message || 'Erro desconhecido',
          });
          console.error(`[ContactImport] ❌ Linha ${rowNumber}: Erro -`, rowError.message);
        }
      }

      // Remover arquivo temporário após processamento
      try {
        fs.unlinkSync(filePath);
        console.log(`[ContactImport] Arquivo temporário removido: ${filePath}`);
      } catch (unlinkError) {
        console.warn(`[ContactImport] ⚠️ Não foi possível remover arquivo temporário: ${filePath}`);
      }

      console.log(`[ContactImport] ✅ Importação concluída: ${result.success} sucessos, ${result.errors} erros, ${result.skipped} ignorados`);
      return result;
    } catch (error: any) {
      console.error('[ContactImport] ❌ Erro ao processar arquivo:', error);
      throw new Error(`Erro ao processar arquivo: ${error.message}`);
    }
  }

  /**
   * Valida o formato do arquivo (Excel ou CSV) antes de importar
   */
  async validateFileFormat(
    filePath: string,
  ): Promise<{ valid: boolean; message?: string; columns?: string[] }> {
    try {
      const ext = path.extname(filePath).toLowerCase();
      let fileColumns: string[] = [];

      if (ext === '.xlsx') {
        fileColumns = await readExcelSheetHeaders(filePath);
      } else if (ext === '.xls') {
        return {
          valid: false,
          message: 'Formato .xls legado não é suportado. Salve o arquivo como .xlsx ou use CSV.',
        };
      } else if (ext === '.csv') {
        // Validar arquivo CSV
        if (!parse) {
          return {
            valid: false,
            message: 'Biblioteca csv-parse não está instalada. Use arquivos Excel (.xlsx)',
          };
        }
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          to_line: 1,
        });
        fileColumns = Object.keys(records[0] || {});
      } else {
        return {
          valid: false,
          message: `Formato não suportado: ${ext}. Use .xlsx, .xls ou .csv`,
        };
      }

      const requiredColumns = ['name', 'phone'];
      const missingColumns = requiredColumns.filter(col => !fileColumns.includes(col.toLowerCase()));
      
      if (missingColumns.length > 0) {
        return {
          valid: false,
          message: `Colunas obrigatórias faltando: ${missingColumns.join(', ')}`,
          columns: fileColumns,
        };
      }

      return {
        valid: true,
        columns: fileColumns,
      };
    } catch (error: any) {
      return {
        valid: false,
        message: `Erro ao validar arquivo: ${error.message}`,
      };
    }
  }
}


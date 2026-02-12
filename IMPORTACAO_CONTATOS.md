# 📥 Importação de Contatos

## Funcionalidades Implementadas

### ✅ 1. Importação de Lista de Contatos via CSV
- Interface completa para upload de arquivo CSV
- Validação de formato e dados
- Processamento em lote
- Relatório detalhado de importação (sucessos, erros, ignorados)
- Download de template CSV

### ✅ 2. Criação Automática de Contatos
- **Já implementado**: Quando um cliente entra em contato via WhatsApp, o contato é criado automaticamente no sistema
- O sistema busca a foto de perfil do WhatsApp
- Valida e limpa números de telefone
- Atualiza contatos existentes com informações corretas

## Instalação

### 1. Instalar dependência CSV Parser
```bash
npm install csv-parse
```

### 2. Reiniciar o servidor
```bash
npm run dev
```

## Como Usar

### Importar Contatos

1. Acesse o menu lateral e clique em **"Importar Contatos"**
2. Selecione o canal onde os contatos serão importados
3. Clique em **"Baixar Template CSV"** para ver o formato esperado
4. Prepare seu arquivo CSV com as colunas:
   - `name` (obrigatório) - Nome do contato
   - `phone` (obrigatório) - Telefone do contato
   - `email` (opcional) - E-mail do contato
5. Faça upload do arquivo CSV
6. Clique em **"Importar Contatos"**
7. Veja o resultado detalhado da importação

### Formato do CSV

```csv
name,phone,email
João Silva,559988776655,joao@example.com
Maria Santos,559977665544,maria@example.com
Pedro Costa,559966554433,
```

**Importante:**
- A primeira linha deve conter os cabeçalhos
- O telefone pode conter caracteres não numéricos (será limpo automaticamente)
- Contatos duplicados serão ignorados (mesmo telefone no mesmo canal)
- Telefones inválidos (menos de 10 dígitos) serão marcados como erro

## API Endpoints

### POST `/api/contacts/import`
Importa contatos de um arquivo CSV.

**Request:**
- `file` (multipart/form-data): Arquivo CSV
- `channelId` (string): ID do canal

**Response:**
```json
{
  "message": "Importação concluída",
  "result": {
    "success": 10,
    "errors": 2,
    "skipped": 1,
    "total": 13,
    "details": [
      {
        "row": 2,
        "contact": "João Silva",
        "status": "success",
        "message": "Contato criado: cm..."
      }
    ]
  }
}
```

### GET `/api/contacts/template`
Baixa um template CSV de exemplo.

## Arquivos Criados

### Backend
- `src/services/contactImportService.ts` - Serviço de importação
- `src/controllers/contactImportController.ts` - Controller de importação
- `src/routes/contactImportRoutes.ts` - Rotas de importação

### Frontend
- `client/src/pages/ContactImport.tsx` - Interface de importação

## Observações

- O sistema já cria contatos automaticamente quando recebe mensagens do WhatsApp
- A importação é útil para adicionar contatos em massa antes de receber mensagens
- Contatos duplicados (mesmo telefone no mesmo canal) são ignorados
- O arquivo CSV é removido automaticamente após o processamento




# Tipos de Blocos do Typebot - Documentação de Referência

Baseado na documentação oficial do Typebot, aqui estão os principais tipos de blocos e suas funcionalidades:

## 📦 Categorias de Blocos

### 1. **Bubbles (Bolhas de Mensagem)**
Blocos que exibem conteúdo para o usuário:

#### **Text (Texto)**
- **Funcionalidade**: Exibe mensagens de texto simples
- **Configurações**:
  - Conteúdo da mensagem (suporta variáveis `{{variavel}}`)
  - Formatação (negrito, itálico, links)
  - Delay antes de exibir
  - Animações de digitação

#### **Image (Imagem)**
- **Funcionalidade**: Exibe imagens
- **Configurações**:
  - URL da imagem
  - Alt text
  - Tamanho (pequeno, médio, grande)
  - Click action (abrir link)

#### **Video (Vídeo)**
- **Funcionalidade**: Exibe vídeos do YouTube, Vimeo ou outros
- **Configurações**:
  - URL do vídeo
  - Autoplay
  - Controles
  - Tamanho

#### **Audio (Áudio)**
- **Funcionalidade**: Reproduz áudio
- **Configurações**:
  - URL do áudio
  - Autoplay
  - Controles

#### **Embed (Incorporado)**
- **Funcionalidade**: Incorpora conteúdo externo via iframe
- **Configurações**:
  - URL do embed
  - Altura e largura
  - Sandbox options

---

### 2. **Inputs (Entradas do Usuário)**
Blocos que coletam dados do usuário:

#### **Text Input (Entrada de Texto)**
- **Funcionalidade**: Campo de texto livre
- **Configurações**:
  - Placeholder
  - Label
  - Validação (required, minLength, maxLength, pattern)
  - Salvar em variável
  - Botão de submit customizado

#### **Email Input (Entrada de Email)**
- **Funcionalidade**: Campo de email com validação
- **Configurações**:
  - Placeholder
  - Label
  - Validação de formato
  - Salvar em variável

#### **Number Input (Entrada de Número)**
- **Funcionalidade**: Campo numérico
- **Configurações**:
  - Placeholder
  - Label
  - Min/Max
  - Step (incremento)
  - Salvar em variável

#### **Phone Number Input (Entrada de Telefone)**
- **Funcionalidade**: Campo de telefone com formatação
- **Configurações**:
  - Placeholder
  - Label
  - Formato (internacional, nacional)
  - Validação
  - Salvar em variável

#### **Date Input (Entrada de Data)**
- **Funcionalidade**: Seletor de data
- **Configurações**:
  - Label
  - Min/Max date
  - Formato de exibição
  - Salvar em variável

#### **File Upload (Upload de Arquivo)**
- **Funcionalidade**: Upload de arquivos
- **Configurações**:
  - Tipos de arquivo permitidos
  - Tamanho máximo
  - Múltiplos arquivos
  - Salvar URL em variável

#### **Picture Choice (Escolha de Imagem)**
- **Funcionalidade**: Seleção de opções com imagens
- **Configurações**:
  - Múltiplas opções com imagens
  - Layout (grid, lista)
  - Múltipla escolha ou única
  - Salvar em variável

#### **Button (Botão)**
- **Funcionalidade**: Botões de ação
- **Configurações**:
  - Texto do botão
  - Ação (ir para bloco, abrir URL, executar código)
  - Estilo (cor, tamanho)
  - Ícone

#### **Choice (Escolha)**
- **Funcionalidade**: Seleção de opções (radio buttons ou checkboxes)
- **Configurações**:
  - Lista de opções
  - Múltipla escolha ou única
  - Layout (botões, lista, dropdown)
  - Salvar em variável

#### **Payment (Pagamento)**
- **Funcionalidade**: Integração com Stripe para pagamentos
- **Configurações**:
  - Valor
  - Moeda
  - Descrição
  - Sucesso/erro actions

---

### 3. **Logic (Lógica)**
Blocos que controlam o fluxo:

#### **Condition (Condição)**
- **Funcionalidade**: Ramifica o fluxo baseado em condições
- **Configurações**:
  - Variável a comparar
  - Operador (equals, contains, greater than, less than, regex, etc.)
  - Valor de comparação
  - Bloco "true" e "false"
  - Múltiplas condições (AND/OR)

#### **Set Variable (Definir Variável)**
- **Funcionalidade**: Define ou atualiza variáveis
- **Configurações**:
  - Nome da variável
  - Valor (pode usar outras variáveis)
  - Tipo (string, number, boolean, object, array)

#### **Redirect (Redirecionamento)**
- **Funcionalidade**: Redireciona para URL
- **Configurações**:
  - URL (pode usar variáveis)
  - Abrir em nova aba
  - Passar variáveis na URL

#### **Script (Script)**
- **Funcionalidade**: Executa código JavaScript customizado
- **Configurações**:
  - Código JavaScript
  - Acesso a variáveis
  - Retorno de valores

#### **Wait (Aguardar)**
- **Funcionalidade**: Pausa o fluxo por tempo determinado
- **Configurações**:
  - Tempo em milissegundos
  - Mensagem durante espera (opcional)

---

### 4. **Integrations (Integrações)**
Blocos que integram com serviços externos:

#### **Webhook (Webhook)**
- **Funcionalidade**: Faz requisição HTTP para URL externa
- **Configurações**:
  - URL
  - Método (GET, POST, PUT, DELETE, PATCH)
  - Headers
  - Body (JSON, form-data, raw)
  - Autenticação (Basic, Bearer, API Key)
  - Salvar resposta em variável
  - Mapear campos da resposta
  - Retry em caso de erro
  - Timeout

#### **Google Sheets (Planilhas Google)**
- **Funcionalidade**: Salva dados no Google Sheets
- **Configurações**:
  - ID da planilha
  - Nome da aba
  - Campos a salvar
  - Credenciais OAuth

#### **OpenAI (IA)**
- **Funcionalidade**: Integração com modelos da OpenAI
- **Configurações**:
  - Modelo (GPT-3.5, GPT-4, etc.)
  - Prompt
  - Variáveis no prompt
  - Temperatura
  - Max tokens
  - Salvar resposta em variável

#### **Zapier (Zapier)**
- **Funcionalidade**: Integração com Zapier
- **Configurações**:
  - Webhook URL do Zapier
  - Dados a enviar

#### **Google Analytics (Analytics)**
- **Funcionalidade**: Rastreia eventos no Google Analytics
- **Configurações**:
  - Event name
  - Event parameters
  - Measurement ID

#### **Meta Pixel (Facebook Pixel)**
- **Funcionalidade**: Rastreia eventos no Facebook Pixel
- **Configurações**:
  - Event name
  - Event parameters
  - Pixel ID

---

### 5. **Advanced (Avançado)**
Blocos para funcionalidades avançadas:

#### **Typebot Link (Link para outro Typebot)**
- **Funcionalidade**: Chama outro bot como sub-bot
- **Configurações**:
  - ID do bot
  - Passar variáveis
  - Aguardar resposta

#### **AB Test (Teste A/B)**
- **Funcionalidade**: Divide usuários em grupos para teste
- **Configurações**:
  - Percentual para cada variante
  - Blocos para cada variante

#### **Jump (Pular)**
- **Funcionalidade**: Pula para outro bloco específico
- **Configurações**:
  - Bloco destino

---

## 🔧 Configurações Comuns a Todos os Blocos

### **Settings Gerais:**
- **ID do bloco**: Identificador único
- **Label**: Nome descritivo do bloco
- **Next block**: Próximo bloco após execução
- **Timeout**: Tempo máximo de espera
- **Retry logic**: Lógica de retry em caso de erro

### **Variables (Variáveis):**
- Todas as variáveis podem ser usadas com sintaxe `{{variavel}}`
- Suporta operações: `.toUpperCase()`, `.toLowerCase()`, `.substring()`, etc.
- Variáveis podem ser globais ou de sessão

### **Advanced Options:**
- **Execute on page load**: Executar quando página carrega
- **Execute only once**: Executar apenas uma vez
- **Hide block**: Ocultar do histórico
- **Custom CSS/JS**: Injetar código customizado

---

## 📊 Estrutura de Dados dos Blocos

```typescript
interface Block {
  id: string;
  type: BlockType;
  label?: string;
  groupId?: string;
  nextBlockId?: string;
  config: BlockConfig;
  position?: { x: number; y: number };
}

type BlockType = 
  | 'text' | 'image' | 'video' | 'audio' | 'embed'
  | 'textInput' | 'emailInput' | 'numberInput' | 'phoneInput' 
  | 'dateInput' | 'fileUpload' | 'pictureChoice' | 'button' | 'choice' | 'payment'
  | 'condition' | 'setVariable' | 'redirect' | 'script' | 'wait'
  | 'webhook' | 'googleSheets' | 'openAI' | 'zapier' | 'googleAnalytics' | 'metaPixel'
  | 'typebotLink' | 'abTest' | 'jump';
```

---

## 🎯 Recomendações para Implementação

1. **Priorizar blocos essenciais primeiro:**
   - Text, Image, Video
   - Text Input, Email Input, Number Input
   - Button, Choice
   - Condition, Set Variable
   - Webhook

2. **Implementar validações:**
   - Todos os inputs devem ter validação
   - Mensagens de erro personalizadas
   - Validação em tempo real (opcional)

3. **Suporte a variáveis:**
   - Sistema de variáveis global e de sessão
   - Parsing de `{{variavel}}` em todos os blocos de texto
   - Operações em variáveis (toUpperCase, etc.)

4. **Integrações:**
   - Começar com Webhook (mais genérico)
   - Depois adicionar integrações específicas

5. **UX:**
   - Preview em tempo real
   - Validação visual de conexões
   - Feedback de erros claros

---

## 📚 Referências

- Documentação oficial: https://docs.typebot.io
- Editor de blocos: https://docs.typebot.io/editor/blocks
- Exemplos: https://docs.typebot.io/examples



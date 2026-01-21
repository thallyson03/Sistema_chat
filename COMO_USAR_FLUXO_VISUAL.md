# 📖 Como Usar o Criador de Fluxo Visual

## 🎯 Funcionalidades Principais

### 1. **Adicionar Nós (Blocos)**
- Clique nos botões na toolbar superior:
  - 💬 **Mensagem**: Envia uma mensagem ao usuário
  - 🔀 **Condição**: Cria uma decisão (Sim/Não)
  - 👤 **Transferir**: Transfere para um agente humano
  - ⏱️ **Aguardar**: Adiciona um delay

### 2. **Mover Nós**
- **Arraste** os nós para reposicioná-los no canvas
- Os nós se alinham automaticamente à grade (snap to grid)

### 3. **Conectar Nós (Criar Caminhos)**

#### **Método 1: Conexão Simples**
1. Passe o mouse sobre um nó
2. Você verá **pontos de conexão** (handles) nas bordas
3. **Clique e arraste** de um ponto de conexão até outro nó
4. Uma linha será criada conectando os dois nós

#### **Método 2: Conexão com Botões (Mensagens)**
1. **Duplo clique** em um nó de mensagem para editá-lo
2. Adicione **botões** (ex: "Sim", "Não", "Enviar")
3. **Salve** o nó
4. **Conecte** arrastando do nó para outros nós
5. Cada conexão será **rotulada** com o texto do botão correspondente

#### **Método 3: Conexão Condicional**
1. **Duplo clique** em um nó de **Condição**
2. Configure a condição (campo, operador, valor)
3. **Conecte** duas vezes:
   - Primeira conexão = **"Sim"** (verde) → quando condição é verdadeira
   - Segunda conexão = **"Não"** (vermelho) → quando condição é falsa

### 4. **Editar Nós**
- **Duplo clique** em qualquer nó para abrir o modal de edição
- Configure:
  - **Mensagem**: Texto e botões
  - **Condição**: Campo, operador e valor
  - **Aguardar**: Tempo em milissegundos

### 5. **Visualizar e Navegar**
- **Zoom**: Use os controles no canto inferior direito
- **Pan**: Arraste o canvas com o mouse
- **Minimap**: Visualize o fluxo completo no canto inferior direito
- **Fit View**: Clique no botão de ajustar visualização

## 📋 Exemplo Prático

### Criar um Fluxo de Atendimento:

1. **Adicionar Nó de Mensagem**
   - Clique em "💬 Mensagem"
   - Duplo clique no nó
   - Digite: "Olá! Como posso ajudar?"
   - Adicione botões: "Produtos", "Suporte", "Cancelar"

2. **Conectar Botões a Diferentes Caminhos**
   - Arraste do nó de mensagem para criar 3 nós diferentes
   - Cada conexão será rotulada com o texto do botão

3. **Adicionar Condição**
   - Adicione um nó de "🔀 Condição"
   - Configure: "message.content CONTAINS preço"
   - Conecte duas vezes:
     - "Sim" → vai para nó de informações de preço
     - "Não" → vai para outro caminho

4. **Salvar**
   - Clique em "💾 Salvar Fluxo" no topo

## 🎨 Dicas

- **Labels nas Conexões**: As conexões mostram automaticamente:
  - Texto do botão (para mensagens com botões)
  - "Sim" ou "Não" (para condições)
  - Cores diferentes para cada tipo

- **Múltiplas Conexões**: Um nó pode ter várias conexões saindo dele
  - Cada botão = uma conexão possível
  - Cada condição = duas conexões (Sim/Não)

- **Organização**: Arraste os nós para organizar o fluxo visualmente
  - Agrupe nós relacionados próximos
  - Use o minimap para navegar em fluxos grandes

## 🔗 Como Funciona a Conexão

1. **Cada botão** em uma mensagem representa um **caminho possível**
2. Quando o usuário **clica no botão**, o bot segue para o nó conectado
3. **Condições** avaliam a mensagem do usuário e seguem para "Sim" ou "Não"
4. O fluxo continua até chegar ao nó "Fim" ou a um handoff




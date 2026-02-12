# Configuração do Magic UI

## Instalação das Dependências

Execute os seguintes comandos no diretório `client`:

```bash
cd client

# Instalar Tailwind CSS e dependências
npm install -D tailwindcss postcss autoprefixer

# Instalar Framer Motion (requerido pelo Magic UI)
npm install framer-motion

# Inicializar Tailwind CSS (se necessário)
npx tailwindcss init -p
```

## Arquivos de Configuração Criados

✅ `tailwind.config.js` - Configuração do Tailwind CSS
✅ `postcss.config.js` - Configuração do PostCSS
✅ `src/index.css` - Atualizado com diretivas do Tailwind

## Como Usar Magic UI

1. Acesse https://magicui.design/
2. Escolha um componente
3. Copie o código do componente
4. Crie um arquivo em `src/components/magic-ui/` (ou onde preferir)
5. Importe e use no seu componente React

## Exemplo de Uso

```tsx
import { Button } from './components/magic-ui/button';

function MyComponent() {
  return (
    <Button>
      Clique aqui
    </Button>
  );
}
```

## Componentes Disponíveis

O Magic UI oferece mais de 150 componentes animados, incluindo:
- Botões animados
- Cards com efeitos
- Modais e diálogos
- Animações de entrada/saída
- Efeitos de hover
- E muito mais!

Acesse https://magicui.design/components para ver todos os componentes disponíveis.




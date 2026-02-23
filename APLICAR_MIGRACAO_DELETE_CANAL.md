# 🔄 Aplicar Migração - Deletar Canal Preservando Dados

## ⚠️ IMPORTANTE

O schema foi atualizado para permitir deletar apenas o canal, preservando os dados históricos (conversas, mensagens, contatos, deals).

## 📋 Mudanças no Schema

1. **Contact.channelId** - Agora é opcional (`String?`) e usa `onDelete: SetNull`
2. **Conversation.channelId** - Agora é opcional (`String?`) e usa `onDelete: SetNull`

Isso significa que quando você deletar um canal:
- ✅ O canal será deletado
- ✅ Contatos e conversas terão `channelId = null`
- ✅ Todos os dados históricos serão preservados

## 🚀 Aplicar Migração

Execute o comando para criar e aplicar a migração:

```bash
npx prisma migrate dev --name allow_delete_channel_preserve_data
```

Ou se preferir apenas gerar a migração sem aplicar:

```bash
npx prisma migrate dev --create-only --name allow_delete_channel_preserve_data
```

Depois revise o arquivo de migração gerado e aplique:

```bash
npx prisma migrate deploy
```

## ✅ Após a Migração

1. **Reinicie o servidor:**
   ```bash
   npm run dev
   ```

2. **Teste deletar um canal:**
   - O canal será deletado
   - Contatos e conversas serão preservados (com `channelId = null`)
   - Mensagens, deals e outros dados serão mantidos

## 🔍 Verificar

Após deletar um canal, você pode verificar que os dados foram preservados:

```sql
-- Verificar contatos sem canal
SELECT * FROM "Contact" WHERE "channelId" IS NULL;

-- Verificar conversas sem canal
SELECT * FROM "Conversation" WHERE "channelId" IS NULL;
```


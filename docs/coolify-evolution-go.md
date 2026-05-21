# Evolution GO no Coolify (do zero)

Guia para subir **Evolution GO** no mesmo estilo do CRM e da stack de observabilidade, com base na [documentação oficial de instalação](https://docs.evolutionfoundation.com.br/evolution-go/installation).

Arquivos no repositório:

| Arquivo | Uso |
|---------|-----|
| `evolution-go/docker-compose.yml` | Coolify com **Git** (recomendado) |
| `evolution-go/docker-compose.coolify-paste.yml` | Colar YAML na UI, sem Git |
| `evolution-go/docker/init-databases.sql` | Cria `evogo_auth` e `evogo_users` no primeiro start do Postgres |

---

## 1) Pré-requisitos

- Servidor com **Coolify** instalado e acesso ao painel.
- Domínio para a API (ex.: `evo-go.chat.chatia.qzz.io`).
- Mínimo **512 MB RAM** livres para Evolution GO + Postgres (recomendado 1 GB+).
- Chaves fortes:
  - `GLOBAL_API_KEY` (header `apikey` em todas as chamadas)
  - `POSTGRES_PASSWORD`

---

## 2) Criar o recurso no Coolify

### Opção A — Via Git (recomendado)

1. Projeto (ex.: **Crm chat** / **production**) → **+ New** → **Docker Compose**.
2. Conecte o repositório `Sistema_chat`.
3. **Base Directory:** `evolution-go`
4. **Docker Compose file:** `docker-compose.yml`
5. Salve e vá para **Environment Variables** (seção 3).

### Opção B — Colar YAML (sem Git)

1. **+ New** → **Docker Compose** → modo **Raw Compose**.
2. Cole o conteúdo de `evolution-go/docker-compose.coolify-paste.yml`.
3. O serviço `postgres-init` cria os bancos na primeira subida.

---

## 3) Variáveis de ambiente (Coolify)

| Variável | Obrigatório | Exemplo / nota |
|----------|-------------|----------------|
| `GLOBAL_API_KEY` | Sim | `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Sim | senha forte |
| `WEBHOOK_URL` | Não (ainda) | `https://crm.chat.chatia.qzz.io/webhooks/evolution-go` — use quando o CRM tiver a rota |
| `DATABASE_SAVE_MESSAGES` | Não | já `false` no compose (CRM persiste mensagens) |

Não use a chave padrão do `.env.example` da Evolution.

---

## 4) Domínio e HTTPS

1. No serviço **evolution-go**, abra **Domains**.
2. Adicione: `https://evo-go.SEU_DOMINIO` (ex.: `https://evo-go.chat.chatia.qzz.io`).
3. Coolify gera certificado Let's Encrypt.
4. Porta do container: **8080** (proxy Coolify → `evolution-go:8080`).

**Não** exponha o Postgres (`5432`) na internet.

---

## 5) Deploy

1. **Deploy** e acompanhe os logs.
2. Ordem esperada: `postgres` healthy → init DB (opção B) ou init script (opção A) → `evolution-go` sobe.

### Bancos (só se o Postgres subir sem init)

Se usar compose manual sem init, entre no container Postgres uma vez:

```bash
psql -U postgres -c "CREATE DATABASE evogo_auth;"
psql -U postgres -c "CREATE DATABASE evogo_users;"
```

---

## 6) Validar instalação

Substitua `SEU_DOMINIO` e `SUA_API_KEY`.

### Health

```bash
curl -sS https://evo-go.SEU_DOMINIO/
```

### Swagger

Abra no navegador:

```
https://evo-go.SEU_DOMINIO/swagger/index.html
```

### Criar instância (conforme doc de instalação)

```bash
curl -sS -X POST "https://evo-go.SEU_DOMINIO/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_GLOBAL_API_KEY" \
  -d "{\"name\":\"teste-crm\",\"token\":\"00000000-0000-4000-8000-000000000001\"}"
```

- Header `apikey` = `GLOBAL_API_KEY` (admin).
- Body `token` = UUID **da instância** (obrigatório na imagem atual; não é a global).

Resposta esperada (200): `data.id` (UUID), `data.name`, `data.token`. O CRM gera o `token` automaticamente.

### QR Code

```bash
curl -sS "https://evo-go.SEU_DOMINIO/instance/teste-crm/qrcode" \
  -H "apikey: SUA_API_KEY"
```

Escaneie com o WhatsApp do número que será o canal.

---

## 7) Webhook → CRM (quando integrar)

1. URL pública do CRM (ex.: `https://crm.chat.chatia.qzz.io`).
2. Rota planejada: `POST /webhooks/evolution-go` (ainda a implementar no backend).
3. No Coolify da Evolution GO, defina:

```env
WEBHOOK_URL=https://crm.chat.chatia.qzz.io/webhooks/evolution-go
```

4. Reinicie o serviço `evolution-go`.

Também será possível configurar webhook **por instância** via API quando o CRM criar o canal.

---

## 8) MinIO (opcional)

Se quiser que o GO armazene mídia no mesmo MinIO do CRM:

```env
MINIO_ENABLED=true
MINIO_ENDPOINT=minio.storage.chat.chatia.qzz.io
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=evolution-media
MINIO_USE_SSL=true
```

Isso é opcional; o CRM já persiste mídia via `mediaPersistJob`.

---

## 9) Checklist pós-deploy

- [ ] Swagger abre com HTTPS
- [ ] `GLOBAL_API_KEY` funciona no header `apikey`
- [ ] Instância criada e QR conectado
- [ ] Logs sem erro de conexão Postgres (`evogo_auth` / `evogo_users`)
- [ ] `WEBHOOK_URL` apontando para o CRM (após integração)
- [ ] Variáveis no CRM: `EVOLUTION_GO_API_URL` + `EVOLUTION_GO_API_KEY`

---

## 10) Problemas comuns

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Evolution GO reinicia em loop | Postgres sem bancos `evogo_*` | Rodar init ou `postgres-init` |
| 401 na API | `apikey` errada | Conferir `GLOBAL_API_KEY` no Coolify |
| Webhook não chega no CRM | URL errada ou rota inexistente | Testar `curl -X POST` na URL do CRM |
| QR não aparece | Instância não criada / nome errado | Swagger → connect/qrcode |

---

## Próximo passo no CRM

Depois desta stack estável:

1. `channel.config.provider = evolution_go`
2. Cliente `evolutionGoApi.ts` com URL `https://evo-go.SEU_DOMINIO`
3. Webhook `POST /webhooks/evolution-go`

Referências: [Instalação Evolution GO](https://docs.evolutionfoundation.com.br/evolution-go/installation) · [Observabilidade no Coolify](./coolify-grafana-prometheus.md)

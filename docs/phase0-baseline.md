# Fase 0 - Baseline de Capacidade e Realtime

Este documento define o baseline inicial para capacidade, latência e estabilidade do sistema antes de otimizações estruturais (filas, workers, adapter distribuído de Socket.IO etc.).

## 1) Objetivo da Fase 0

- Medir o estado atual com dados reais de ambiente.
- Estabelecer SLOs mínimos de operação.
- Criar um ritual repetível de teste para comparar evolução entre versões.

## 2) Meta de carga considerada

- 300 usuários
- 300 conversas por dia
- média de 1000 mensagens por conversa
- alto volume de requisições simultâneas
- operação em tempo real

## 3) SLOs iniciais (propostos)

- `POST /api/webhooks/*` p95 < 300ms
- `GET /api/conversations` p95 < 800ms
- `GET /api/messages/conversation/:id` p95 < 800ms
- Erro 5xx < 1% em janelas de 5 minutos
- Realtime (evento até atualização visual) p95 < 2s

## 4) Métricas obrigatórias para coletar

### API
- RPS por rota
- latência p50/p95/p99 por rota
- taxa de erro 4xx/5xx
- timeout por integração (Meta/Evolution)

### Banco (PostgreSQL)
- conexões ativas
- tempo médio de query (rotas quentes)
- locks e deadlocks
- crescimento de `Message` por dia

### Realtime (Socket.IO)
- conexões ativas
- eventos/s emitidos
- proporção de eventos globais vs eventos segmentados

### Infra
- CPU, RAM
- IOPS e latência de disco
- tráfego de rede

## 5) Roteiro de execução (sem alterar produção)

1. Subir backend e frontend no ambiente-alvo.
2. Definir token de teste válido.
3. Rodar teste de carga de baseline (k6).
4. Coletar métricas de API/DB/infra em paralelo.
5. Consolidar relatório com:
   - gargalos principais
   - regressões
   - margem de crescimento

## 6) Script de carga da Fase 0

Arquivo: `scripts/load/phase0-conversations.js`

Comandos:

```bash
# teste rápido (2 minutos)
npm run perf:phase0:quick

# teste completo (configurado no próprio script)
npm run perf:phase0
```

Variáveis de ambiente aceitas pelo script:

- `BASE_URL` (default: `http://localhost:3007`)
- `TOKEN` (JWT para endpoints autenticados)
- `VUS` (default: `50`)
- `DURATION` (default: `5m`)

Exemplo:

```bash
k6 run -e BASE_URL=https://seu-dominio -e TOKEN=seu_jwt -e VUS=80 -e DURATION=10m scripts/load/phase0-conversations.js
```

## 7) Critério de "pronto para avançar"

Podemos sair da Fase 0 quando:

- baseline estiver versionado e repetível;
- métricas de latência/erro estiverem coletadas;
- top 5 gargalos estiverem priorizados para Fase 1.

## 8) Observações importantes

- A Fase 0 não muda arquitetura, apenas mede e organiza.
- Resultados de pico são mais importantes que média.
- Guardar os relatórios por data para comparar tendências.


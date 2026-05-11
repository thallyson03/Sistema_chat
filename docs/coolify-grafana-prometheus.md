# Grafana + Prometheus no Coolify

Este guia sobe observabilidade tecnica para o CRM usando os arquivos em `observability/`.

## 1) Backend: endpoint /metrics

Ja foi adicionado no backend:

- endpoint: `GET /metrics`
- metrica HTTP:
  - `crm_http_requests_total`
  - `crm_http_request_duration_ms_bucket`
- metrica de fila:
  - `crm_queue_counters`
- metricas de processo (default do prom-client):
  - CPU, memoria, event loop, GC

### Proteger o endpoint (recomendado)

No backend, configure:

- `METRICS_AUTH_TOKEN=<token-forte>`

Sem essa variavel, `/metrics` fica sem autenticacao.

## 2) Criar stack no Coolify

1. No projeto **Crm chat** > **production**, clique **+ New** > **Docker Compose**.
2. Use o repositorio Git e aponte o compose para `observability/docker-compose.yml`  
   (ou **Base Directory** = `observability` e arquivo `docker-compose.yml`).  
   Importante: o compose monta `prometheus/entrypoint.sh` por caminho relativo — precisa vir do **repo**, nao apenas YAML colado na mao.
3. Defina variaveis da stack (exemplos):

**Grafana**

- `GRAFANA_ADMIN_USER=admin`
- `GRAFANA_ADMIN_PASSWORD=<senha-forte>`
- `GRAFANA_ROOT_URL=https://SEU_DOMINIO_GRAFANA`

**Prometheus → CRM (HTTPS publico, mesmo cenario Coolify)**

- `CRM_METRICS_HOST=crm.chat.chatia.qzz.io` (padrao no compose se omitir)
- `CRM_METRICS_PORT=443` (padrao)
- `CRM_SKIP_TLS_VERIFY=false` (use `true` so se o certificado quebrar validacao)
- `CRM_METRICS_BEARER_TOKEN` — **veja secao 3**

4. Deploy da stack.

## 3) Precisa de `credentials` / Bearer no Prometheus?

Depende do backend:

| Backend | Prometheus |
|---------|------------|
| **Sem** `METRICS_AUTH_TOKEN` no CRM | **Nao** defina `CRM_METRICS_BEARER_TOKEN` (vazio). O scrape funciona sem `authorization`. |
| **Com** `METRICS_AUTH_TOKEN` no CRM | Defina `CRM_METRICS_BEARER_TOKEN` com o **mesmo valor** do `METRICS_AUTH_TOKEN`. O `entrypoint.sh` gera `credentials_file` no job `crm-backend`. |

Ou seja: **nao e obrigatorio** ter credencial no Prometheus a menos que voce tenha protegido `/metrics` no app.

O arquivo `observability/prometheus/prometheus.yml` no repo serve de **referencia / dev local**; em Coolify a config efetiva e gerada pelo script `observability/prometheus/entrypoint.sh` na subida do container.

## 4) Validar se esta coletando

- Prometheus: `http(s)://SEU_PROMETHEUS:9090/targets`
  - alvo `crm-backend` deve aparecer como **UP**
- Grafana: `http(s)://SEU_GRAFANA`
  - login com variaveis admin
  - dashboard `CRM Operacao` ja provisionado automaticamente

## 5) Alertas tecnicos minimos no Grafana

Crie regras com janela de 5-10 min:

- `5xx > 1%` por 5 min
- `429 > 2%` por 10 min
- `p95 > 1200ms` por 10 min
- `p99 > 2000ms` por 10 min

Expressao base para `5xx`:

```promql
100 * sum(rate(crm_http_requests_total{status_code=~"5.."}[5m])) / clamp_min(sum(rate(crm_http_requests_total[5m])), 1)
```

Expressao base para `429`:

```promql
100 * sum(rate(crm_http_requests_total{status_code="429"}[5m])) / clamp_min(sum(rate(crm_http_requests_total[5m])), 1)
```

Expressao base para p95:

```promql
histogram_quantile(0.95, sum(rate(crm_http_request_duration_ms_bucket[5m])) by (le))
```

## 6) Rotina diaria sugerida

- 2 checks por dia (manha/fim do dia)
- revisar `5xx`, `429`, p95/p99 e fila
- registrar incidente, acao e resultado em log operacional

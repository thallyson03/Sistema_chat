# 📊 Requisitos de Servidor para Hospedagem

## 🎯 Visão Geral

Este documento descreve as características de servidor necessárias para hospedar o Sistema de Atendimento ao Cliente, considerando diferentes cenários de uso e volume de tráfego.

## 🛠️ Stack Tecnológica

- **Backend**: Node.js 18+ (Express + TypeScript)
- **Frontend**: React 18+ (Vite)
- **Banco de Dados**: PostgreSQL 12+
- **Tempo Real**: Socket.IO (WebSocket)
- **Integração WhatsApp**: Evolution API (Docker ou instalação manual)
- **ORM**: Prisma

---

## 📈 Cenários de Uso

### 🟢 Pequeno Porte
**Perfil:**
- Até 10 usuários simultâneos
- Até 1.000 mensagens/dia
- 1-3 canais WhatsApp
- Até 50 conversas ativas simultâneas

**Requisitos Mínimos:**
```
CPU: 2 vCPUs (cores)
RAM: 4 GB
Armazenamento: 40 GB SSD
Largura de Banda: 100 Mbps
Sistema Operacional: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
```

**Custo Estimado (Cloud):**
- DigitalOcean Droplet: ~$24/mês
- AWS EC2 t3.medium: ~$30/mês
- Vultr: ~$24/mês

---

### 🟡 Médio Porte
**Perfil:**
- Até 50 usuários simultâneos
- Até 10.000 mensagens/dia
- 5-10 canais WhatsApp
- Até 200 conversas ativas simultâneas

**Requisitos Recomendados:**
```
CPU: 4 vCPUs (cores)
RAM: 8 GB
Armazenamento: 80 GB SSD
Largura de Banda: 500 Mbps
Sistema Operacional: Ubuntu 22.04+ / Debian 12+
```

**Custo Estimado (Cloud):**
- DigitalOcean Droplet: ~$48/mês
- AWS EC2 t3.large: ~$60/mês
- Vultr: ~$48/mês

---

### 🔴 Grande Porte
**Perfil:**
- 50-200+ usuários simultâneos
- 50.000+ mensagens/dia
- 10+ canais WhatsApp
- 500+ conversas ativas simultâneas

**Requisitos Avançados:**
```
CPU: 8+ vCPUs (cores)
RAM: 16 GB+
Armazenamento: 160 GB+ SSD (ou NVMe)
Largura de Banda: 1 Gbps+
Sistema Operacional: Ubuntu 22.04 LTS
Load Balancer: Recomendado
```

**Custo Estimado (Cloud):**
- DigitalOcean Droplet: ~$96-192/mês
- AWS EC2 t3.xlarge: ~$120-240/mês
- Vultr: ~$96-192/mês

---

## 💾 Armazenamento

### Espaço Necessário

**Base do Sistema:**
- Aplicação Node.js: ~500 MB
- Frontend build: ~50 MB
- Node modules: ~300 MB
- PostgreSQL: ~1-5 GB (dependendo do histórico)

**Crescimento Estimado:**
- Mensagens: ~1 KB por mensagem
- Arquivos/Imagens: ~100 KB por arquivo
- Logs: ~100 MB/mês

**Recomendações:**
- **Pequeno**: 40 GB (permite ~6 meses de histórico)
- **Médio**: 80 GB (permite ~12 meses de histórico)
- **Grande**: 160 GB+ (permite histórico ilimitado ou arquivamento)

---

## 🌐 Rede e Conectividade

### Requisitos de Rede

**Portas Necessárias:**
- `3001` - Backend API (ou porta customizada)
- `3000` - Frontend (desenvolvimento) ou usar Nginx
- `5432` - PostgreSQL (recomendado: apenas localhost)
- `8080` - Evolution API (ou porta customizada)
- `80/443` - HTTP/HTTPS (via Nginx/Apache)

**Largura de Banda:**
- **Pequeno**: 100 Mbps (suficiente para até 10 usuários)
- **Médio**: 500 Mbps (recomendado para 50 usuários)
- **Grande**: 1 Gbps+ (necessário para alta concorrência)

**Latência:**
- Ideal: < 50ms para usuários
- Aceitável: < 100ms
- Crítico: > 200ms (afeta experiência)

---

## 🗄️ Banco de Dados PostgreSQL

### Requisitos Específicos

**Versão Mínima:** PostgreSQL 12+

**Configurações Recomendadas:**
```sql
-- Memória compartilhada
shared_buffers = 25% da RAM
effective_cache_size = 50-75% da RAM

-- Conexões
max_connections = 100 (pequeno) a 200 (grande)

-- Performance
work_mem = 4MB (pequeno) a 16MB (grande)
maintenance_work_mem = 64MB (pequeno) a 256MB (grande)
```

**Backup:**
- Automático diário (recomendado)
- Retenção: 7-30 dias
- Espaço adicional: +20% do tamanho do banco

---

## 🐳 Evolution API (WhatsApp)

### Requisitos Adicionais

**Docker (Recomendado):**
- Docker Engine 20.10+
- Docker Compose 2.0+
- Espaço adicional: ~2-5 GB

**Recursos:**
- CPU: +1 vCPU (se rodar no mesmo servidor)
- RAM: +1-2 GB (se rodar no mesmo servidor)

**Alternativa:**
- Rodar em servidor separado (recomendado para médio/grande porte)
- Usar serviço gerenciado (Evolution API Cloud)

---

## 🔒 Segurança

### Requisitos de Segurança

**SSL/TLS:**
- Certificado SSL válido (Let's Encrypt gratuito)
- HTTPS obrigatório em produção

**Firewall:**
- Apenas portas necessárias abertas
- SSH apenas com chave (sem senha)
- Fail2ban configurado

**Backup:**
- Backup automático diário
- Teste de restauração mensal
- Backup off-site (recomendado)

---

## 📊 Monitoramento

### Ferramentas Recomendadas

**Sistema:**
- htop / top (CPU, RAM)
- df -h (disco)
- netstat / ss (rede)

**Aplicação:**
- PM2 (gerenciamento de processos Node.js)
- Nginx logs (acesso)
- PostgreSQL logs (queries lentas)

**Monitoramento Externo:**
- UptimeRobot (disponibilidade)
- New Relic / Datadog (APM - opcional)
- Grafana + Prometheus (métricas - avançado)

---

## 🚀 Otimizações

### Para Melhor Performance

**Node.js:**
- Usar PM2 com cluster mode (múltiplos processos)
- Habilitar gzip compression
- Cache de respostas (Redis - opcional)

**PostgreSQL:**
- Índices nas colunas mais consultadas
- Vacuum automático configurado
- Connection pooling (PgBouncer - opcional)

**Frontend:**
- CDN para assets estáticos
- Compressão de imagens
- Lazy loading

---

## 💰 Estimativa de Custos Mensais

### Pequeno Porte
```
Servidor: $24-30/mês
Domínio: $10-15/ano
SSL: Grátis (Let's Encrypt)
Backup: Incluído ou $5/mês
Total: ~$30/mês
```

### Médio Porte
```
Servidor: $48-60/mês
Domínio: $10-15/ano
SSL: Grátis
Backup: $10/mês
Monitoramento: $10/mês (opcional)
Total: ~$60-80/mês
```

### Grande Porte
```
Servidor: $96-240/mês
Domínio: $10-15/ano
SSL: Grátis
Backup: $20/mês
Monitoramento: $20/mês
Load Balancer: $20/mês (opcional)
Total: ~$150-300/mês
```

---

## 🏗️ Arquitetura Recomendada

### Pequeno/Médio Porte (Monolito)
```
┌─────────────────┐
│   Nginx (80/443) │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ Node  │ │Postgre│
│  App  │ │  SQL  │
└───────┘ └───────┘
```

### Grande Porte (Distribuído)
```
┌─────────────────┐
│  Load Balancer   │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ Node  │ │Postgre│
│  App  │ │  SQL  │
│(x2-4) │ │(Master│
└───────┘ │+Slave)│
          └───────┘
```

---

## ✅ Checklist de Implementação

- [ ] Servidor com specs adequadas ao volume esperado
- [ ] Ubuntu/Debian instalado e atualizado
- [ ] Node.js 18+ instalado
- [ ] PostgreSQL instalado e configurado
- [ ] Nginx instalado e configurado
- [ ] SSL/TLS configurado (Let's Encrypt)
- [ ] Firewall configurado (UFW)
- [ ] PM2 instalado para gerenciar Node.js
- [ ] Backup automático configurado
- [ ] Monitoramento básico configurado
- [ ] Evolution API instalada (Docker ou manual)
- [ ] Domínio apontado para o servidor
- [ ] Variáveis de ambiente configuradas (.env)
- [ ] Prisma migrations executadas
- [ ] Usuário admin criado

---

## 📝 Notas Finais

1. **Comece pequeno**: É melhor começar com recursos menores e escalar conforme necessário
2. **Monitore**: Acompanhe uso de CPU, RAM e disco regularmente
3. **Backup**: Nunca pule backups, são essenciais
4. **Segurança**: Mantenha sistema e dependências atualizados
5. **Teste de carga**: Faça testes antes de ir para produção

---

## 🔗 Recursos Úteis

- [DigitalOcean Droplets](https://www.digitalocean.com/products/droplets)
- [AWS EC2](https://aws.amazon.com/ec2/)
- [Vultr](https://www.vultr.com/)
- [Let's Encrypt](https://letsencrypt.org/)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [PostgreSQL Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)



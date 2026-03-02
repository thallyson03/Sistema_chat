# Guia de Atualização: Ubuntu 20.04 → Ubuntu 22.04 LTS

## 📋 Situação Atual do Servidor

### Recursos Disponíveis
- **Disco:** 194GB (190GB disponível) ✅ Suficiente
- **RAM:** 23GB ✅ Suficiente
- **Sistema:** Ubuntu 20.04.6 LTS (Focal Fossa)
- **Kernel:** 5.15.0-1081-oracle

### Software Instalado
- **Node.js:** 18.20.8
- **NPM:** 10.8.2
- **Nginx:** 1.18.0
- **PostgreSQL:** 12.22
- **PM2:** Process Manager (aplicação `ceapdesk` rodando)

### Serviços Ativos
- ✅ Nginx (site: centralcrm.ceapebank.com.br)
- ✅ PostgreSQL 12 (3 bancos: ceape_tickets, sistema_tickets, postgres)
- ✅ PM2 (aplicação ceapdesk)

---

## ⚠️ PRÉ-REQUISITOS E PREPARAÇÃO

### 1. **BACKUP COMPLETO (OBRIGATÓRIO)**

#### Backup do PostgreSQL
```bash
# Conectar ao servidor
ssh -i ~/ssh-key-2025-08-12.ceape.key ubuntu@129.146.176.225

# Criar diretório de backup
sudo mkdir -p /backup/pre-upgrade
sudo chown ubuntu:ubuntu /backup/pre-upgrade

# Backup de todos os bancos
sudo -u postgres pg_dumpall > /backup/pre-upgrade/postgresql_all_$(date +%Y%m%d_%H%M%S).sql

# Backup individual de cada banco
sudo -u postgres pg_dump ceape_tickets > /backup/pre-upgrade/ceape_tickets_$(date +%Y%m%d_%H%M%S).sql
sudo -u postgres pg_dump sistema_tickets > /backup/pre-upgrade/sistema_tickets_$(date +%Y%m%d_%H%M%S).sql
```

#### Backup de Arquivos da Aplicação
```bash
# Backup do diretório da aplicação (se existir)
sudo tar -czf /backup/pre-upgrade/app_$(date +%Y%m%d_%H%M%S).tar.gz /home/ubuntu/app 2>/dev/null || true

# Backup das configurações do Nginx
sudo tar -czf /backup/pre-upgrade/nginx_$(date +%Y%m%d_%H%M%S).tar.gz /etc/nginx/

# Backup das configurações do PM2
cp -r ~/.pm2 /backup/pre-upgrade/pm2_backup_$(date +%Y%m%d_%H%M%S)
```

#### Backup Remoto (Recomendado)
```bash
# Baixar backups para sua máquina local
scp -i ~/ssh-key-2025-08-12.ceape.key -r ubuntu@129.146.176.225:/backup/pre-upgrade ./backups_servidor/
```

### 2. **Verificações Antes da Atualização**

```bash
# Verificar espaço em disco (mínimo 10GB livre recomendado)
df -h

# Verificar integridade dos pacotes
sudo dpkg --audit

# Verificar serviços críticos
systemctl status nginx
systemctl status postgresql@12-main
pm2 status

# Verificar logs recentes
sudo journalctl -p err -n 50
```

### 3. **Janela de Manutenção**
- ⏱️ **Tempo estimado:** 1-2 horas
- 🔴 **Downtime esperado:** 30-60 minutos
- ⚠️ **Recomendado:** Fazer em horário de baixo tráfego

---

## 🔄 PROCESSO DE ATUALIZAÇÃO

### Passo 1: Atualizar Ubuntu 20.04 para a última versão
```bash
sudo apt update
sudo apt upgrade -y
sudo apt dist-upgrade -y
sudo apt autoremove -y
sudo reboot
```

### Passo 2: Instalar Ferramenta de Atualização
```bash
sudo apt install update-manager-core -y
```

### Passo 3: Verificar se está pronto para atualização
```bash
sudo do-release-upgrade -c
```

### Passo 4: Executar a Atualização
```bash
# Modo interativo (recomendado para primeira vez)
sudo do-release-upgrade

# OU modo não-interativo (mais rápido, mas menos controle)
sudo do-release-upgrade -f DistUpgradeViewNonInteractive
```

**Durante a atualização:**
- ⚠️ Será perguntado sobre substituir arquivos de configuração
- ✅ Escolha **"N"** para manter suas configurações personalizadas
- ⚠️ Alguns pacotes podem ser removidos (será avisado)

### Passo 5: Reiniciar o Sistema
```bash
sudo reboot
```

---

## 🔧 PÓS-ATUALIZAÇÃO

### 1. Verificar Versão
```bash
lsb_release -a
# Deve mostrar: Ubuntu 22.04 LTS (Jammy Jellyfish)
```

### 2. Atualizar Pacotes
```bash
sudo apt update
sudo apt upgrade -y
```

### 3. Verificar e Reinstalar Software

#### Node.js (pode precisar reinstalar)
```bash
# Verificar versão atual
node --version

# Se necessário, reinstalar Node.js 18 ou 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node --version
npm --version
```

#### PostgreSQL (pode precisar atualizar)
```bash
# Ubuntu 22.04 vem com PostgreSQL 14 por padrão
# Você pode manter PostgreSQL 12 ou atualizar para 14

# Verificar versão instalada
psql --version

# Se precisar manter PostgreSQL 12:
sudo apt install postgresql-12

# OU atualizar para PostgreSQL 14 (recomendado):
# 1. Fazer backup completo (já feito)
# 2. Instalar PostgreSQL 14
sudo apt install postgresql-14

# 3. Migrar dados (processo complexo, requer pg_upgrade)
```

#### Nginx
```bash
# Verificar se está rodando
sudo systemctl status nginx

# Testar configuração
sudo nginx -t

# Se houver erros, verificar configurações
sudo nano /etc/nginx/sites-available/centralcrm.ceapebank.com.br
```

#### PM2
```bash
# Verificar processos
pm2 list

# Se necessário, reinstalar PM2 globalmente
sudo npm install -g pm2

# Restaurar processos
pm2 resurrect
# OU
pm2 start ecosystem.config.js
```

### 4. Verificar Serviços
```bash
# Verificar todos os serviços
sudo systemctl status nginx
sudo systemctl status postgresql@12-main  # ou postgresql@14-main
pm2 status

# Verificar logs
sudo journalctl -u nginx -n 50
sudo journalctl -u postgresql -n 50
pm2 logs
```

### 5. Testar Aplicação
```bash
# Verificar se a aplicação está respondendo
curl -I http://localhost
curl -I https://centralcrm.ceapebank.com.br  # se configurado
```

---

## ⚠️ PROBLEMAS COMUNS E SOLUÇÕES

### Problema 1: PostgreSQL não inicia
```bash
# Verificar logs
sudo journalctl -u postgresql -n 50

# Verificar permissões
sudo chown -R postgres:postgres /var/lib/postgresql
sudo chmod 700 /var/lib/postgresql/12/main
```

### Problema 2: Nginx não inicia
```bash
# Verificar sintaxe
sudo nginx -t

# Verificar permissões de certificados SSL (se houver)
sudo ls -la /etc/letsencrypt/
```

### Problema 3: Node.js não encontrado
```bash
# Reinstalar Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Problema 4: PM2 processos não iniciam
```bash
# Limpar e reiniciar PM2
pm2 kill
pm2 resurrect
# OU
pm2 start ecosystem.config.js
```

---

## 📊 COMPATIBILIDADE DE VERSÕES

### Ubuntu 20.04 → 22.04

| Software | Versão Atual | Versão Ubuntu 22.04 | Ação Necessária |
|----------|--------------|---------------------|-----------------|
| Node.js  | 18.20.8      | Não incluído        | Reinstalar      |
| Nginx    | 1.18.0       | 1.18.0+             | Atualizar        |
| PostgreSQL | 12.22      | 14.x (padrão)       | Manter 12 ou migrar para 14 |
| PM2      | -            | -                   | Reinstalar      |

---

## 🎯 ALTERNATIVA: Atualização Incremental

Se preferir uma abordagem mais conservadora:

### Opção 1: Manter Ubuntu 20.04 com ESM
```bash
# Habilitar Ubuntu Pro (gratuito até 5 máquinas)
sudo pro attach <token>
# Isso dá acesso a atualizações de segurança até 2030
```

### Opção 2: Criar Snapshot Antes de Atualizar
- No Oracle Cloud Console, criar um snapshot do volume
- Isso permite reverter se algo der errado

---

## ✅ CHECKLIST FINAL

Antes de iniciar:
- [ ] Backup completo do PostgreSQL
- [ ] Backup das configurações do Nginx
- [ ] Backup do PM2 e aplicação
- [ ] Backup baixado localmente
- [ ] Janela de manutenção agendada
- [ ] Usuários notificados sobre downtime
- [ ] Snapshot do servidor (recomendado)

Após atualização:
- [ ] Verificar versão do Ubuntu
- [ ] Reinstalar Node.js se necessário
- [ ] Verificar PostgreSQL
- [ ] Verificar Nginx
- [ ] Verificar PM2 e aplicação
- [ ] Testar funcionalidades críticas
- [ ] Monitorar logs por 24h

---

## 📞 SUPORTE

Se encontrar problemas durante a atualização:
1. Verificar logs: `sudo journalctl -xe`
2. Verificar espaço em disco: `df -h`
3. Verificar serviços: `systemctl list-units --failed`
4. Restaurar backup se necessário

---

**Última atualização:** 26/02/2026
**Versão do documento:** 1.0



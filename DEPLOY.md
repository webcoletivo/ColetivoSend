# Guia de Deploy - Hostinger (VPS)

Este guia explica como preparar sua aplicação ColetivoSend para produção.

## 1. Banco de Dados

Você tem **duas opções** excelentes para produção. Escolha a que preferir:

---

### Opção A: PostgreSQL Externo (Recomendada - EasyPanel)
Se você já tem um PostgreSQL no EasyPanel, é perfeito.

1. No EasyPanel, crie um **PostgreSQL**.
2. Copie a **Internal Connection String** (se estiver na mesma rede) ou **Public Connection String** (se estiver fora).
   *   Exemplo: `postgresql://user:pass@host:5432/db`
3. No servidor VPS da Hostinger:
   ```bash
   # Use o schema do Postgres
   cp prisma/schema.postgres.prisma prisma/schema.prisma
   ```
4. No arquivo `.env`, cole sua URL do EasyPanel:
   ```env
   DATABASE_URL="sua-url-do-easypanel"
   ```

---

### Opção B: MySQL Nativo (Hostinger)
Se preferir usar o MySQL fornecido pela Hostinger:

1. No painel Hostinger, crie um **Banco de Dados MySQL**.
2. No servidor VPS:
   ```bash
   # Use o schema do MySQL
   cp prisma/schema.mysql.prisma prisma/schema.prisma
   ```
3. Construa a URL de conexão MySQL no `.env`:
   ```env
   # mysql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO
   DATABASE_URL="mysql://u12345:senha123@sql.hostinger.com:3306/u12345_coletivosend"
   ```

---

### Finalizando o Banco (Para qualquer opção)

Após configurar o `.env` com a URL correta e copiar o schema certo:

```bash
npx prisma generate
npx prisma db push
```

## 2. Configuração de E-mail (SMTP)

Para que seus emails cheguem na Caixa de Entrada (e não no Spam), você precisa de duas coisas: **Credenciais** e **DNS**.

### A. Credenciais (no .env)
A Hostinger (ou qualquer provedor como Resend, SendGrid, Zoho) vai te fornecer:

*   **Host:** `smtp.hostinger.com` (exemplo)
*   **Port:** `587` (TLS) ou `465` (SSL)
*   **User:** `no-reply@seudominio.com` (Crie essa conta no painel de email)
*   **Pass:** A senha que você definiu para essa conta.

### B. DNS (Obrigatório para não cair no Spam)
No painel de controle do seu domínio (onde você comprou o domínio), você **PRECISA** configurar estes registros TXT. Se não fizer isso, emails como "Recuperar Senha" serão bloqueados.

1.  **SPF (Sender Policy Framework):**
    Autoriza a Hostinger a enviar emails em seu nome.
    *   Tipo: `TXT`
    *   Nome: `@`
    *   Valor: `v=spf1 include:_spf.mail.hostinger.com ~all` (Exemplo da Hostinger)

2.  **DKIM (DomainKeys Identified Mail):**
    Assinatura digital. O valor é uma chave longa que você copia do painel de email da Hostinger.

3.  **DMARC:**
    Política de segurança.
    *   Tipo: `TXT`
    *   Nome: `_dmarc`
    *   Valor: `v=DMARC1; p=none;` (Para começar)

### Testando
Após configurar, use o site [Mail-Tester](https://www.mail-tester.com/) para verificar se sua pontuação está 10/10.

## 3. Rodando a Aplicação

Para rodar em produção, use:

```bash
npm run build
npm start
```

Recomendamos usar PM2 para manter o site online:

```bash
npm install -g pm2
pm2 start npm --name "flowsend" -- start
```

## Importante: Armazenamento de Arquivos

Como você está usando VPS, os arquivos de upload serão salvos na pasta local `/uploads`.
Certifique-se de que essa pasta tem permissão de escrita e que seu disco tem espaço suficiente.

Não é necessário configurar S3 se o espaço em disco da VPS for suficiente.

## 5. Configuração para Arquivos Grandes (1GB+)

Para permitir o upload de arquivos grandes (até 1GB ou mais), você precisa ajustar o proxy reverso (Nginx) que geralmente fica na frente da aplicação.

### Se usando EasyPanel / Docker
1.  Vá nas configurações do serviço.
2.  Procure por "Proxy Config" ou "Nginx Config".
3.  Adicione/ajuste a seguinte linha:
    ```nginx
    client_max_body_size 1024M;
    ```
4.  Aumente também o timeout se necessário:
    ```nginx
    proxy_read_timeout 300;
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
    ```

### Se usando Nginx direto (VPS limpa)
1.  Edite o arquivo de configuração (ex: `/etc/nginx/sites-available/default`).
2.  Dentro do bloco `server { ... }` ou `location / { ... }`, adicione:
    ```nginx
    client_max_body_size 1024M;
    ```
3.  Reinicie o Nginx: `sudo service nginx restart`.

> **Nota:** O código da aplicação já está configurado para aceitar até 1GB (via variáveis de ambiente). O bloqueio geralmente ocorre "antes" de chegar no Node.js (no Nginx/Cloudflare).


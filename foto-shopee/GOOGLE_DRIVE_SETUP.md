# 🔑 Como configurar o Google Drive

Este guia explica como criar uma **Service Account** no Google Cloud para que o sistema salve as fotos automaticamente no seu Google Drive.

---

## Passo 1 — Criar um projeto no Google Cloud

1. Acesse https://console.cloud.google.com
2. Clique em **"Selecionar projeto"** → **"Novo projeto"**
3. Dê um nome (ex: `fotoshop`) e clique em **Criar**

---

## Passo 2 — Ativar a Google Drive API

1. No menu lateral, vá em **"APIs e serviços"** → **"Biblioteca"**
2. Pesquise por **"Google Drive API"**
3. Clique nela e depois em **"Ativar"**

---

## Passo 3 — Criar a Service Account

1. Vá em **"APIs e serviços"** → **"Credenciais"**
2. Clique em **"+ Criar credenciais"** → **"Conta de serviço"**
3. Preencha:
   - Nome: `fotoshop-upload`
   - Clique em **Criar e continuar**
4. Em "Conceder acesso", selecione o papel **"Editor"**
5. Clique em **Continuar** → **Concluir**

---

## Passo 4 — Baixar o arquivo de credenciais

1. Na lista de contas de serviço, clique na que você acabou de criar
2. Vá na aba **"Chaves"**
3. Clique em **"Adicionar chave"** → **"Criar nova chave"**
4. Selecione **JSON** e clique em **Criar**
5. Um arquivo `.json` será baixado — **guarde-o com segurança!**

---

## Passo 5 — Configurar no projeto

### Opção A: Arquivo (mais simples para desenvolvimento local)

1. Renomeie o arquivo baixado para `credentials.json`
2. Coloque-o dentro da pasta `backend/`:

```
foto-shopee/
└── backend/
    ├── credentials.json   ← aqui
    ├── server.js
    └── ...
```

> ⚠️ **NUNCA suba o `credentials.json` para o GitHub!**
> O `.gitignore` já está configurado para ignorá-lo.

### Opção B: Variáveis de ambiente (recomendado para produção)

1. Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

2. Abra o `credentials.json` baixado e copie os valores:

```json
{
  "client_email": "fotoshop@seu-projeto.iam.gserviceaccount.com",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n..."
}
```

3. Cole no `.env`:

```env
GOOGLE_CLIENT_EMAIL=fotoshop@seu-projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEo...\n-----END RSA PRIVATE KEY-----\n"
```

---

## Passo 6 — Compartilhar a pasta com a Service Account

> Este passo é **obrigatório** para que as fotos apareçam no seu Google Drive pessoal.

A Service Account tem seu próprio "Drive isolado". Para ver os arquivos no **seu** Drive:

1. Abra o Google Drive (drive.google.com) com sua conta pessoal
2. Crie uma pasta (ex: `FotoShop - Pedidos`)
3. Clique com o botão direito → **"Compartilhar"**
4. Cole o e-mail da Service Account (ex: `fotoshop@seu-projeto.iam.gserviceaccount.com`)
5. Defina permissão como **"Editor"**
6. Clique em **Compartilhar**
7. Copie o **ID da pasta** da URL (parte após `/folders/`):
   ```
   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^
   ```
8. Adicione no `.env`:
   ```env
   DRIVE_ROOT_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
   ```

---

## Passo 7 — Instalar dependências e testar

```bash
cd backend
npm install
npm run dev
```

Acesse http://localhost:3000, envie uma foto de teste e verifique se aparece no Google Drive!

---

## Estrutura de pastas no Drive

```
📁 FotoShop - Pedidos
├── 📁 Pedido_123456789
│   ├── 🖼️ 123456789_joao_001.jpg
│   ├── 🖼️ 123456789_joao_002.jpg
│   └── 📄 metadata.json
└── 📁 Pedido_987654321
    ├── 🖼️ 987654321_maria_001.jpg
    └── 📄 metadata.json
```

---

## Dúvidas frequentes

**"Permission denied" ao fazer upload**
→ Verifique se compartilhou a pasta raiz com o e-mail da Service Account (Passo 6).

**"Credentials not found"**
→ Verifique se o `credentials.json` está em `backend/` ou se as variáveis de ambiente estão corretas.

**"API not enabled"**
→ Volte ao Passo 2 e certifique-se de que a Google Drive API está ativa.

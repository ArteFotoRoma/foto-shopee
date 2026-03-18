# 📸 FotoShop — Sistema de Envio de Fotos

Sistema web para clientes enviarem fotos de pedidos da Shopee de forma simples e organizada.

---

## 🗂️ Estrutura do Projeto

```
foto-shopee/
├── backend/
│   ├── routes/
│   │   ├── upload.js      # rota POST /api/upload
│   │   └── admin.js       # rota GET /api/admin/pedidos, download ZIP, delete
│   ├── server.js          # servidor Express principal
│   └── package.json
├── frontend/
│   ├── css/
│   │   ├── style.css      # estilos da página do cliente
│   │   └── admin.css      # estilos do painel admin
│   ├── js/
│   │   ├── upload.js      # drag-and-drop, preview, envio
│   │   └── admin.js       # listagem, filtros, download ZIP
│   ├── index.html         # página do cliente
│   └── admin.html         # painel administrativo
├── uploads/               # criado automaticamente
│   └── {pedidoId}/
│       ├── foto1.jpg
│       ├── foto2.jpg
│       └── metadata.json
└── README.md
```

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org) v18 ou superior
- npm (já vem com o Node)

### 1. Instalar dependências

```bash
cd backend
npm install
```

### 2. Iniciar o servidor

```bash
# modo produção
npm start

# modo desenvolvimento (reinicia automaticamente)
npm run dev
```

### 3. Acessar no navegador

| Página | URL |
|--------|-----|
| Área do cliente | http://localhost:3000 |
| Painel admin | http://localhost:3000/admin.html |

---

## 🔐 Painel Administrativo

- **Senha padrão:** `shopee2024`
- Para alterar, defina a variável de ambiente `ADMIN_PASSWORD`:

```bash
# Linux / Mac
ADMIN_PASSWORD=minhaSenhaSegura npm start

# Windows PowerShell
$env:ADMIN_PASSWORD="minhaSenhaSegura"; npm start
```

---

## 📁 Onde ficam os arquivos

Os uploads são salvos em:

```
uploads/
└── {id-do-pedido}/
    ├── 123456_joaosilva_001.jpg
    ├── 123456_joaosilva_002.jpg
    └── metadata.json          ← informações do pedido
```

O `metadata.json` contém:
```json
{
  "pedidoId": "123456789",
  "nomeCliente": "João Silva",
  "tamanho": "10x15",
  "quantidade": 5,
  "dataEnvio": "2024-01-15T14:30:00.000Z",
  "codigoEnvio": "A3F9C2B1",
  "arquivos": ["123456789_JoaoSilva_001.jpg", "..."]
}
```

---

## ⚙️ Configurações (variáveis de ambiente)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | Porta do servidor |
| `ADMIN_PASSWORD` | `shopee2024` | Senha do painel admin |

---

## 🔄 Migração para Cloud (AWS S3)

O projeto está estruturado para fácil migração. Para usar S3:

1. Instale o AWS SDK: `npm install @aws-sdk/client-s3 multer-s3`
2. Em `backend/routes/upload.js`, substitua o `storage` do multer:

```js
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3     = require('multer-s3');

const s3 = new S3Client({ region: 'us-east-1' });

const storage = multerS3({
  s3,
  bucket: 'seu-bucket-nome',
  key: (req, file, cb) => {
    const pedidoId = req.body.pedidoId;
    cb(null, `uploads/${pedidoId}/${file.originalname}`);
  }
});
```

---

## 🛡️ Segurança Implementada

- Validação de tipo de arquivo (apenas JPG/PNG pelo MIME type)
- Limite de 10 MB por arquivo
- Sanitização do `pedidoId` para evitar path traversal
- Rate limiting global (100 req/15 min por IP)
- Autenticação por senha no painel admin

---

## 🚀 Melhorias Futuras Sugeridas

### Prioridade Alta
- [ ] Autenticação JWT no painel admin (em vez de senha simples)
- [ ] Migração para AWS S3 ou Cloudflare R2
- [ ] Notificação por email/WhatsApp quando pedido é recebido
- [ ] Compressão automática de imagens (sharp)

### Prioridade Média
- [ ] Dashboard com gráficos de pedidos por dia
- [ ] Pré-visualização das fotos no painel admin
- [ ] Exportar relatório CSV dos pedidos
- [ ] Suporte a reenvio com histórico de versões

### Prioridade Baixa
- [ ] PWA (Progressive Web App) para funcionar offline
- [ ] Integração com API da Shopee para validar pedido
- [ ] Multi-idioma (PT/EN/ES)
- [ ] Tema escuro

---

## 📦 Dependências

| Pacote | Versão | Uso |
|--------|--------|-----|
| express | ^4.18 | servidor web |
| multer | ^1.4 | upload de arquivos |
| archiver | ^6.0 | geração de ZIP |
| cors | ^2.8 | Cross-Origin Resource Sharing |
| uuid | ^9.0 | geração de códigos únicos |
| express-rate-limit | ^7.1 | proteção contra abuso |
| nodemon | ^3.0 | reinício automático (dev) |

/**
 * googleDrive.js — utilitário para interagir com a Google Drive API
 *
 * Usa uma Service Account para autenticação sem interação do usuário.
 * Configure as variáveis de ambiente ou coloque o arquivo credentials.json
 * na raiz do backend (nunca suba esse arquivo para o git!).
 *
 * Fluxo:
 *   1. Autentica via Service Account
 *   2. Cria uma pasta raiz "FotoShop - Pedidos" (se não existir)
 *   3. Para cada pedido, cria uma subpasta com o ID do pedido
 *   4. Faz upload dos arquivos para essa subpasta
 *   5. Salva metadata.json na mesma subpasta
 */

const { google } = require('googleapis');
const { Readable } = require('stream');
const path = require('path');
const fs   = require('fs');

// ── autenticação ───────────────────────────────────────────────────────────
function criarAuth() {
  // opção 1: variáveis de ambiente (recomendado para produção)
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key : process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  }

  // opção 2: arquivo credentials.json na raiz do backend
  const credPath = path.join(__dirname, '..', 'credentials.json');
  if (fs.existsSync(credPath)) {
    return new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes : ['https://www.googleapis.com/auth/drive'],
    });
  }

  throw new Error(
    'Credenciais do Google não encontradas.\n' +
    'Defina GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY no .env\n' +
    'ou coloque o arquivo credentials.json na pasta backend/'
  );
}

// cliente Drive (criado uma vez, reutilizado)
let driveClient = null;

async function getDrive() {
  if (!driveClient) {
    const auth  = criarAuth();
    driveClient = google.drive({ version: 'v3', auth });
  }
  return driveClient;
}

// ── nome da pasta raiz no Drive ────────────────────────────────────────────
const PASTA_RAIZ_NOME = process.env.DRIVE_ROOT_FOLDER_NAME || 'FotoShop - Pedidos';

// cache do ID da pasta raiz para evitar consultas repetidas
let pastaRaizId = process.env.DRIVE_ROOT_FOLDER_ID || null;

/**
 * Garante que a pasta raiz "FotoShop - Pedidos" existe no Drive.
 * Retorna o ID da pasta.
 */
async function garantirPastaRaiz() {
  if (pastaRaizId) return pastaRaizId;

  const drive = await getDrive();

  // busca a pasta raiz pelo nome
  const busca = await drive.files.list({
    q         : `name='${PASTA_RAIZ_NOME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields    : 'files(id, name)',
    pageSize  : 1,
  });

  if (busca.data.files.length > 0) {
    pastaRaizId = busca.data.files[0].id;
    return pastaRaizId;
  }

  // cria a pasta raiz se não existir
  const criada = await drive.files.create({
    requestBody: {
      name    : PASTA_RAIZ_NOME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  pastaRaizId = criada.data.id;
  console.log(`📁 Pasta raiz criada no Drive: "${PASTA_RAIZ_NOME}" (${pastaRaizId})`);
  return pastaRaizId;
}

/**
 * Cria (ou reutiliza) uma subpasta para o pedido dentro da pasta raiz.
 * @param {string} pedidoId
 * @returns {string} ID da pasta do pedido no Drive
 */
async function garantirPastaPedido(pedidoId) {
  const drive    = await getDrive();
  const raizId   = await garantirPastaRaiz();
  const nomePasta = `Pedido_${pedidoId}`;

  // verifica se já existe (reenvio)
  const busca = await drive.files.list({
    q         : `name='${nomePasta}' and '${raizId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields    : 'files(id, name)',
    pageSize  : 1,
  });

  if (busca.data.files.length > 0) {
    return busca.data.files[0].id;
  }

  // cria nova pasta para o pedido
  const criada = await drive.files.create({
    requestBody: {
      name    : nomePasta,
      mimeType: 'application/vnd.google-apps.folder',
      parents : [raizId],
    },
    fields: 'id',
  });

  return criada.data.id;
}

/**
 * Faz upload de um arquivo (Buffer) para a pasta do pedido no Drive.
 * @param {object} opts
 * @param {string}  opts.pastaPedidoId  — ID da pasta no Drive
 * @param {string}  opts.nomeArquivo    — nome final do arquivo
 * @param {Buffer}  opts.buffer         — conteúdo do arquivo
 * @param {string}  opts.mimeType       — ex: 'image/jpeg'
 * @returns {string} ID do arquivo criado no Drive
 */
async function uploadArquivo({ pastaPedidoId, nomeArquivo, buffer, mimeType }) {
  const drive  = await getDrive();
  const stream = Readable.from(buffer);

  const resposta = await drive.files.create({
    requestBody: {
      name   : nomeArquivo,
      parents: [pastaPedidoId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name, webViewLink',
  });

  return resposta.data;
}

/**
 * Faz upload do metadata.json para a pasta do pedido.
 * Sobrescreve se já existir (reenvio).
 */
async function uploadMetadata({ pastaPedidoId, metadata }) {
  const drive   = await getDrive();
  const conteudo = Buffer.from(JSON.stringify(metadata, null, 2), 'utf8');
  const stream   = Readable.from(conteudo);

  // verifica se já existe um metadata.json na pasta
  const busca = await drive.files.list({
    q       : `name='metadata.json' and '${pastaPedidoId}' in parents and trashed=false`,
    fields  : 'files(id)',
    pageSize: 1,
  });

  if (busca.data.files.length > 0) {
    // atualiza o existente
    await drive.files.update({
      fileId  : busca.data.files[0].id,
      media   : { mimeType: 'application/json', body: stream },
    });
  } else {
    // cria novo
    await drive.files.create({
      requestBody: { name: 'metadata.json', parents: [pastaPedidoId] },
      media       : { mimeType: 'application/json', body: stream },
      fields      : 'id',
    });
  }
}

/**
 * Retorna o link da pasta do pedido no Google Drive.
 */
async function linkPasta(pastaPedidoId) {
  const drive = await getDrive();
  const res   = await drive.files.get({
    fileId: pastaPedidoId,
    fields: 'webViewLink',
  });
  return res.data.webViewLink;
}

/**
 * Lista arquivos de imagem dentro de uma pasta do Drive.
 * Usado pelo admin para contar arquivos no reenvio.
 */
async function listarArquivos(pastaPedidoId) {
  const drive = await getDrive();
  const res   = await drive.files.list({
    q       : `'${pastaPedidoId}' in parents and trashed=false and name != 'metadata.json'`,
    fields  : 'files(id, name, size)',
    pageSize: 200,
  });
  return res.data.files;
}

module.exports = {
  garantirPastaPedido,
  uploadArquivo,
  uploadMetadata,
  linkPasta,
  listarArquivos,
};

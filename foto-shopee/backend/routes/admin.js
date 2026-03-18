/**
 * rota /api/admin — versão Google Drive
 *
 * Lista pedidos lendo os metadata.json de cada subpasta do Drive.
 * Download de ZIP: baixa as imagens do Drive e compacta na hora.
 */

const express  = require('express');
const archiver = require('archiver');

const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shopee2024';

function autenticar(req, res, next) {
  const senha = req.query.senha || req.headers['x-admin-senha'];
  if (senha !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Acesso negado. Senha incorreta.' });
  }
  next();
}

// helper: cria cliente Drive autenticado
async function getDrive() {
  const { google } = require('googleapis');
  const path = require('path');
  const fs   = require('fs');

  let auth;
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key : process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  } else {
    const credPath = path.join(__dirname, '../../credentials.json');
    auth = new google.auth.GoogleAuth({ keyFile: credPath, scopes: ['https://www.googleapis.com/auth/drive'] });
  }
  return google.drive({ version: 'v3', auth });
}

// GET /api/admin/pedidos
router.get('/pedidos', autenticar, async (req, res) => {
  try {
    const drive = await getDrive();
    const nomePastaRaiz = process.env.DRIVE_ROOT_FOLDER_NAME || 'FotoShop - Pedidos';
    let raizId = process.env.DRIVE_ROOT_FOLDER_ID || null;

    if (!raizId) {
      const buscaRaiz = await drive.files.list({
        q: `name='${nomePastaRaiz}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)', pageSize: 1,
      });
      if (!buscaRaiz.data.files.length) return res.json({ pedidos: [], total: 0 });
      raizId = buscaRaiz.data.files[0].id;
    }

    const subpastas = await drive.files.list({
      q: `'${raizId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)', pageSize: 500, orderBy: 'createdTime desc',
    });

    const pedidos = [];
    for (const pasta of subpastas.data.files) {
      const buscaMeta = await drive.files.list({
        q: `name='metadata.json' and '${pasta.id}' in parents and trashed=false`,
        fields: 'files(id)', pageSize: 1,
      });
      if (!buscaMeta.data.files.length) continue;

      const metaFile = await drive.files.get(
        { fileId: buscaMeta.data.files[0].id, alt: 'media' },
        { responseType: 'text' }
      );
      let meta;
      try { meta = JSON.parse(metaFile.data); } catch { continue; }

      const imagens = await drive.files.list({
        q: `'${pasta.id}' in parents and trashed=false and name != 'metadata.json'`,
        fields: 'files(id)', pageSize: 200,
      });

      pedidos.push({
        pasta      : pasta.id,
        pedidoId   : meta.pedidoId,
        nomeCliente: meta.nomeCliente || '—',
        tamanho    : meta.tamanho    || '—',
        quantidade : imagens.data.files.length,
        dataEnvio  : meta.dataEnvio,
        codigoEnvio: meta.codigoEnvio,
        reenvios   : meta.reenvios || 0,
      });
    }

    res.json({ pedidos, total: pedidos.length });
  } catch (err) {
    console.error('Erro ao listar pedidos:', err.message);
    res.status(500).json({ error: 'Erro ao listar pedidos.' });
  }
});

// GET /api/admin/download/:pastaId
router.get('/download/:pastaId', autenticar, async (req, res) => {
  try {
    const drive   = await getDrive();
    const pastaId = req.params.pastaId;

    const listaArquivos = await drive.files.list({
      q: `'${pastaId}' in parents and trashed=false and name != 'metadata.json'`,
      fields: 'files(id, name, mimeType)', pageSize: 200,
    });

    if (!listaArquivos.data.files.length) {
      return res.status(404).json({ error: 'Nenhuma imagem encontrada.' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="pedido_${pastaId}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', err => res.status(500).end());
    archive.pipe(res);

    for (const arquivo of listaArquivos.data.files) {
      const fileStream = await drive.files.get(
        { fileId: arquivo.id, alt: 'media' },
        { responseType: 'stream' }
      );
      archive.append(fileStream.data, { name: arquivo.name });
    }

    const buscaMeta = await drive.files.list({
      q: `name='metadata.json' and '${pastaId}' in parents and trashed=false`,
      fields: 'files(id)', pageSize: 1,
    });
    if (buscaMeta.data.files.length) {
      const metaStream = await drive.files.get(
        { fileId: buscaMeta.data.files[0].id, alt: 'media' },
        { responseType: 'stream' }
      );
      archive.append(metaStream.data, { name: 'info_pedido.json' });
    }

    archive.finalize();
  } catch (err) {
    console.error('Erro no download:', err.message);
    res.status(500).json({ error: 'Erro ao gerar ZIP.' });
  }
});

// DELETE /api/admin/pedido/:pastaId
router.delete('/pedido/:pastaId', autenticar, async (req, res) => {
  try {
    const drive   = await getDrive();
    await drive.files.update({ fileId: req.params.pastaId, requestBody: { trashed: true } });
    res.json({ success: true, mensagem: 'Pedido movido para a lixeira do Drive.' });
  } catch (err) {
    console.error('Erro ao deletar:', err.message);
    res.status(500).json({ error: 'Erro ao remover pedido.' });
  }
});

module.exports = router;

/**
 * rota /api/upload — com Google Drive
 *
 * Arquivos recebidos em memória (multer.memoryStorage) e enviados
 * diretamente para a pasta do pedido no Google Drive.
 * Nenhum arquivo é gravado no disco local do servidor.
 */

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');

const drive = require('../utils/googleDrive');

const router = express.Router();

// ── multer: armazenamento em memória (sem disco) ───────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),

  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Formato inválido. Envie apenas JPG ou PNG.'), false);
  },

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB por arquivo
    files   : 100,
  },
});

// ── POST /api/upload ───────────────────────────────────────────────────────
router.post('/', upload.array('fotos', 100), async (req, res) => {
  try {
    const { pedidoId, nomeCliente, tamanho, quantidade } = req.body;

    // ── validações ──────────────────────────────────────────────────────
    if (!pedidoId || !pedidoId.trim()) {
      return res.status(400).json({ error: 'ID do pedido é obrigatório.' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhuma imagem recebida.' });
    }
    const qtdInformada = parseInt(quantidade, 10);
    if (!isNaN(qtdInformada) && req.files.length !== qtdInformada) {
      return res.status(400).json({
        error: `Quantidade informada (${qtdInformada}) não bate com arquivos enviados (${req.files.length}).`,
      });
    }

    // ── sanitiza strings para uso em nomes de arquivo ──────────────────
    const idLimpo   = pedidoId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const nomeLimpo = (nomeCliente || 'cliente').trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .substring(0, 30) || 'cliente';

    // ── cria/reutiliza pasta do pedido no Drive ─────────────────────────
    const pastaPedidoId = await drive.garantirPastaPedido(idLimpo);

    // ── faz upload de cada imagem para o Drive ──────────────────────────
    const arquivosEnviados = [];

    for (let i = 0; i < req.files.length; i++) {
      const file        = req.files[i];
      const ext         = path.extname(file.originalname).toLowerCase() || '.jpg';
      const contador    = String(i + 1).padStart(3, '0');
      const nomeArquivo = `${idLimpo}_${nomeLimpo}_${contador}${ext}`;

      const resultado = await drive.uploadArquivo({
        pastaPedidoId,
        nomeArquivo,
        buffer  : file.buffer,
        mimeType: file.mimetype,
      });

      arquivosEnviados.push(resultado.name);
    }

    // ── salva metadata.json no Drive ────────────────────────────────────
    const codigoEnvio = uuidv4().split('-')[0].toUpperCase();

    const metadata = {
      pedidoId   : pedidoId.trim(),
      nomeCliente: (nomeCliente || '').trim(),
      tamanho    : tamanho || '',
      quantidade : req.files.length,
      dataEnvio  : new Date().toISOString(),
      codigoEnvio,
      arquivos   : arquivosEnviados,
      driveFolder: pastaPedidoId,
    };

    await drive.uploadMetadata({ pastaPedidoId, metadata });

    // link direto para a pasta no Drive
    const linkDrive = await drive.linkPasta(pastaPedidoId);

    res.json({
      success      : true,
      mensagem     : 'Fotos enviadas com sucesso para o Google Drive!',
      codigoEnvio,
      totalArquivos: req.files.length,
      linkDrive,
    });

  } catch (err) {
    console.error('Erro no upload para o Drive:', err.message);
    res.status(500).json({ error: err.message || 'Erro interno ao processar o upload.' });
  }
});

// ── erros do multer ────────────────────────────────────────────────────────
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Arquivo muito grande. Limite: 10 MB por imagem.' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Muitos arquivos. Máximo: 100 imagens por envio.' });
  }
  res.status(400).json({ error: err.message || 'Erro no envio.' });
});

module.exports = router;

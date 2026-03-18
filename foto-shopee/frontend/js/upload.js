/**
 * upload.js — lógica da página do cliente
 * drag-and-drop, preview, validação, barra de progresso, envio via XHR
 */

(function () {
  'use strict';

  // ── referências ao DOM ────────────────────────────────────────────────
  const form         = document.getElementById('uploadForm');
  const dropzone     = document.getElementById('dropzone');
  const fileInput    = document.getElementById('fileInput');
  const btnSelect    = document.getElementById('btnSelect');
  const previewGrid  = document.getElementById('previewGrid');
  const fileCount    = document.getElementById('fileCount');
  const progressWrap = document.getElementById('progressWrap');
  const progressFill = document.getElementById('progressFill');
  const progressPct  = document.getElementById('progressPct');
  const btnSubmit    = document.getElementById('btnSubmit');

  // banco de arquivos selecionados (DataTransfer não é serializável, guardamos em array)
  let selectedFiles = [];

  // ── drag and drop ─────────────────────────────────────────────────────
  ['dragenter','dragover'].forEach(ev =>
    dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('drag-over'); })
  );
  ['dragleave','drop'].forEach(ev =>
    dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('drag-over'); })
  );
  dropzone.addEventListener('drop', e => {
    addFiles(Array.from(e.dataTransfer.files));
  });

  // abre o seletor de arquivo ao clicar em qualquer parte da dropzone
  dropzone.addEventListener('click', e => {
    if (e.target !== btnSelect) fileInput.click();
  });
  btnSelect.addEventListener('click', e => {
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files));
    fileInput.value = ''; // limpa para permitir re-seleção do mesmo arquivo
  });

  // ── gerenciar arquivos ────────────────────────────────────────────────
  function addFiles(files) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 10 * 1024 * 1024; // 10 MB

    files.forEach(f => {
      if (!allowed.includes(f.type)) {
        showInlineError(`"${f.name}" não é JPG/PNG e foi ignorado.`);
        return;
      }
      if (f.size > maxSize) {
        showInlineError(`"${f.name}" é maior que 10 MB e foi ignorado.`);
        return;
      }
      // evita duplicatas pelo nome+tamanho
      const dup = selectedFiles.some(s => s.name === f.name && s.size === f.size);
      if (!dup) selectedFiles.push(f);
    });

    renderPreviews();
    updateFileCount();
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderPreviews();
    updateFileCount();
  }

  function renderPreviews() {
    previewGrid.innerHTML = '';
    selectedFiles.forEach((file, i) => {
      const url  = URL.createObjectURL(file);
      const item = document.createElement('div');
      item.className = 'preview-item';
      item.innerHTML = `
        <img src="${url}" alt="foto ${i + 1}" loading="lazy" />
        <button class="preview-remove" type="button" title="Remover">×</button>
      `;
      item.querySelector('.preview-remove').addEventListener('click', () => {
        URL.revokeObjectURL(url);
        removeFile(i);
      });
      previewGrid.appendChild(item);
    });
  }

  function updateFileCount() {
    const n   = selectedFiles.length;
    const qtd = parseInt(document.getElementById('quantidade').value, 10);

    if (n === 0) {
      fileCount.textContent = '';
      fileCount.className   = 'file-count';
      return;
    }

    fileCount.textContent = `${n} arquivo${n > 1 ? 's' : ''} selecionado${n > 1 ? 's' : ''}`;

    if (!isNaN(qtd) && qtd > 0) {
      if (n === qtd) {
        fileCount.textContent += ' ✓ bate com a quantidade informada';
        fileCount.className = 'file-count ok';
      } else {
        fileCount.textContent += ` — informado: ${qtd}`;
        fileCount.className = 'file-count warning';
      }
    } else {
      fileCount.className = 'file-count';
    }
  }

  // atualiza o contador quando o campo quantidade muda
  document.getElementById('quantidade').addEventListener('input', updateFileCount);

  // ── validação ─────────────────────────────────────────────────────────
  function validate() {
    const pedidoId  = document.getElementById('pedidoId').value.trim();
    const tamanho   = document.getElementById('tamanho').value;
    const quantidade = parseInt(document.getElementById('quantidade').value, 10);

    if (!pedidoId) {
      showModal('errorModal', 'Preencha o Nº do Pedido antes de enviar.');
      return false;
    }
    if (!tamanho) {
      showModal('errorModal', 'Selecione o tamanho das fotos.');
      return false;
    }
    if (isNaN(quantidade) || quantidade < 1) {
      showModal('errorModal', 'Informe a quantidade de fotos.');
      return false;
    }
    if (selectedFiles.length === 0) {
      showModal('errorModal', 'Adicione pelo menos uma foto antes de enviar.');
      return false;
    }
    if (selectedFiles.length !== quantidade) {
      showModal('errorModal', `Você informou ${quantidade} foto${quantidade > 1 ? 's' : ''}, mas selecionou ${selectedFiles.length}. Corrija e tente novamente.`);
      return false;
    }
    return true;
  }

  // ── envio via XHR (permite barra de progresso) ─────────────────────────
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return;

    const formData = new FormData();
    formData.append('pedidoId',    document.getElementById('pedidoId').value.trim());
    formData.append('nomeCliente', document.getElementById('nomeCliente').value.trim());
    formData.append('tamanho',     document.getElementById('tamanho').value);
    formData.append('quantidade',  document.getElementById('quantidade').value);
    selectedFiles.forEach(f => formData.append('fotos', f));

    const xhr = new XMLHttpRequest();

    // progresso de upload
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = pct + '%';
        progressPct.textContent  = pct + '%';
      }
    });

    xhr.addEventListener('load', () => {
      btnSubmit.disabled = false;
      progressWrap.hidden = true;

      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && res.success) {
          document.getElementById('codigoEnvio').textContent = res.codigoEnvio || '—';
          showModal('successModal');
        } else {
          showModal('errorModal', res.error || 'Erro ao enviar as fotos.');
        }
      } catch {
        showModal('errorModal', 'Erro inesperado ao processar resposta do servidor.');
      }
    });

    xhr.addEventListener('error', () => {
      btnSubmit.disabled = false;
      progressWrap.hidden = true;
      showModal('errorModal', 'Falha de conexão. Verifique sua internet e tente novamente.');
    });

    // inicia envio
    btnSubmit.disabled = true;
    progressWrap.hidden = false;
    progressFill.style.width = '0%';
    progressPct.textContent  = '0%';

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });

  // ── helpers de modal ──────────────────────────────────────────────────
  function showModal(id, msg) {
    if (msg) document.getElementById('errorMsg').textContent = msg;
    document.getElementById(id).hidden = false;
  }

  window.closeModal = function (id) {
    document.getElementById(id).hidden = true;
  };

  window.resetForm = function () {
    document.getElementById('successModal').hidden = true;
    form.reset();
    selectedFiles = [];
    previewGrid.innerHTML = '';
    fileCount.textContent = '';
    progressWrap.hidden   = true;
  };

  // ── mensagem inline temporária ─────────────────────────────────────────
  function showInlineError(msg) {
    const el = document.createElement('p');
    el.style.cssText = 'font-size:.78rem;color:#DC2626;margin-top:.5rem;';
    el.textContent   = msg;
    previewGrid.parentNode.insertBefore(el, previewGrid.nextSibling);
    setTimeout(() => el.remove(), 4000);
  }

})();

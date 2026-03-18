/**
 * admin.js — lógica do painel administrativo
 * login simples por senha, listagem de pedidos, download de ZIP
 */

(function () {
  'use strict';

  let senha     = '';
  let todosOsPedidos = [];

  // ── login ──────────────────────────────────────────────────────────────
  const loginOverlay = document.getElementById('loginOverlay');
  const adminContent = document.getElementById('adminContent');
  const senhaInput   = document.getElementById('senhaInput');
  const btnLogin     = document.getElementById('btnLogin');

  // verifica se já tem senha na sessão
  const senhaSession = sessionStorage.getItem('adminSenha');
  if (senhaSession) {
    senha = senhaSession;
    mostrarPainel();
  }

  btnLogin.addEventListener('click', fazerLogin);
  senhaInput.addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); });

  async function fazerLogin() {
    const tentativa = senhaInput.value.trim();
    if (!tentativa) return;

    // valida contra a API
    try {
      const res  = await fetch(`/api/admin/pedidos?senha=${encodeURIComponent(tentativa)}`);
      if (res.status === 401) {
        senhaInput.style.borderColor = '#DC2626';
        senhaInput.value = '';
        senhaInput.placeholder = 'Senha incorreta. Tente novamente.';
        setTimeout(() => {
          senhaInput.style.borderColor = '';
          senhaInput.placeholder = 'Senha de acesso';
        }, 2500);
        return;
      }
      // senha correta
      senha = tentativa;
      sessionStorage.setItem('adminSenha', senha);
      mostrarPainel();
    } catch {
      alert('Erro ao conectar ao servidor.');
    }
  }

  function mostrarPainel() {
    loginOverlay.style.display = 'none';
    adminContent.hidden = false;
    carregarPedidos();
  }

  document.getElementById('btnLogout').addEventListener('click', () => {
    sessionStorage.removeItem('adminSenha');
    location.reload();
  });

  // ── carregar pedidos ───────────────────────────────────────────────────
  async function carregarPedidos() {
    try {
      const res  = await fetch(`/api/admin/pedidos?senha=${encodeURIComponent(senha)}`);
      const data = await res.json();

      if (!res.ok) {
        mostrarErro(data.error || 'Erro ao carregar pedidos.');
        return;
      }

      todosOsPedidos = data.pedidos || [];
      atualizarMetricas(todosOsPedidos);
      renderizarTabela(todosOsPedidos);

    } catch {
      mostrarErro('Falha de conexão ao carregar pedidos.');
    }
  }

  document.getElementById('btnRefresh').addEventListener('click', carregarPedidos);

  // ── métricas ───────────────────────────────────────────────────────────
  function atualizarMetricas(pedidos) {
    document.getElementById('metricTotal').textContent = pedidos.length;
    document.getElementById('metricFotos').textContent =
      pedidos.reduce((acc, p) => acc + (p.quantidade || 0), 0);

    if (pedidos.length > 0) {
      const d = new Date(pedidos[0].dataEnvio);
      document.getElementById('metricUltimo').textContent =
        d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } else {
      document.getElementById('metricUltimo').textContent = '—';
    }
  }

  // ── tabela ─────────────────────────────────────────────────────────────
  function renderizarTabela(pedidos) {
    const tbody = document.getElementById('pedidosBody');

    if (pedidos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Nenhum pedido encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = pedidos.map(p => {
      const data = new Date(p.dataEnvio).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      const reenvioTag = p.reenvios > 0
        ? `<span class="pill pill-reenvio">${p.reenvios}× reenvio</span>`
        : '';

      return `
        <tr>
          <td><strong>${escHtml(p.pedidoId)}</strong></td>
          <td>${escHtml(p.nomeCliente)}</td>
          <td>${escHtml(p.tamanho)}</td>
          <td>${p.quantidade} ${reenvioTag}</td>
          <td>${data}</td>
          <td><span class="pill">${escHtml(p.codigoEnvio)}</span></td>
          <td>
            <button class="btn-download" onclick="baixarZip('${escHtml(p.pasta)}')">⬇ ZIP</button>
            <button class="btn-delete"   onclick="deletarPedido('${escHtml(p.pasta)}')">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ── busca + filtro ─────────────────────────────────────────────────────
  const searchInput  = document.getElementById('searchInput');
  const filterSelect = document.getElementById('filterSize');

  function aplicarFiltros() {
    const busca    = searchInput.value.toLowerCase();
    const tamanho  = filterSelect.value;

    const filtrados = todosOsPedidos.filter(p => {
      const matchBusca  = !busca  ||
        p.pedidoId.toLowerCase().includes(busca) ||
        (p.nomeCliente || '').toLowerCase().includes(busca);
      const matchTamanho = !tamanho || p.tamanho === tamanho;
      return matchBusca && matchTamanho;
    });

    renderizarTabela(filtrados);
  }

  searchInput.addEventListener('input',  aplicarFiltros);
  filterSelect.addEventListener('change', aplicarFiltros);

  // ── ações globais ──────────────────────────────────────────────────────
  window.baixarZip = function (pedidoId) {
    const url = `/api/admin/download/${encodeURIComponent(pedidoId)}?senha=${encodeURIComponent(senha)}`;
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `pedido_${pedidoId}.zip`;
    a.click();
  };

  window.deletarPedido = async function (pedidoId) {
    if (!confirm(`Remover pedido "${pedidoId}" e todas as fotos? Esta ação não pode ser desfeita.`)) return;

    try {
      const res = await fetch(
        `/api/admin/pedido/${encodeURIComponent(pedidoId)}?senha=${encodeURIComponent(senha)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (res.ok) {
        carregarPedidos();
      } else {
        alert(data.error || 'Erro ao remover pedido.');
      }
    } catch {
      alert('Falha de conexão.');
    }
  };

  // ── helpers ────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mostrarErro(msg) {
    const tbody = document.getElementById('pedidosBody');
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty" style="color:#DC2626">${escHtml(msg)}</td></tr>`;
  }

})();

// Ajustes específicos do atendimento interno.
// O fluxo interno não oferece deslocamento, chegada ou agendamento inicial.
(() => {
  const BLOQUEADOS_INTERNO = new Set(['Agendado', 'Aberto', 'Em deslocamento', 'No local', 'Aguardando cliente']);

  function tipoAtual() {
    const tipo = document.querySelector('#f-tipo, [name="service_type"], [name="serviceType"]');
    if (tipo) return String(tipo.value || '').toLowerCase();
    const modo = document.getElementById('drawer-mode')?.textContent || '';
    if (/atendimento interno/i.test(modo)) return 'interno';
    return '';
  }

  function ehInterna() {
    return tipoAtual() === 'interno';
  }

  function limparOpcoesInternas() {
    if (!ehInterna()) return;
    document.querySelectorAll('select').forEach((select) => {
      const id = String(select.id || '').toLowerCase();
      const name = String(select.name || '').toLowerCase();
      const pareceStatus = id.includes('status') || name.includes('status') || id.includes('tipo-status');
      if (!pareceStatus) return;
      [...select.options].forEach((option) => {
        if (BLOQUEADOS_INTERNO.has(String(option.value || option.textContent || '').trim())) option.remove();
      });
    });
  }

  function limparAcoesInternas() {
    if (!ehInterna()) return;
    const area = document.getElementById('drawer-body') || document.getElementById('drawer');
    if (!area) return;
    area.querySelectorAll('button').forEach((button) => {
      const texto = String(button.textContent || '').trim();
      if (BLOQUEADOS_INTERNO.has(texto)) button.remove();
    });
    document.querySelectorAll('#drawer-ft button').forEach((button) => {
      const texto = String(button.textContent || '').trim();
      if (BLOQUEADOS_INTERNO.has(texto)) button.remove();
    });
  }

  function aplicar() {
    limparOpcoesInternas();
    limparAcoesInternas();
  }

  document.addEventListener('DOMContentLoaded', () => {
    aplicar();
    const observer = new MutationObserver(aplicar);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();

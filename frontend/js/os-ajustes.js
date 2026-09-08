// Ajustes específicos das regras de abertura e atendimento.
(() => {
  const BLOQUEADOS_INTERNO = new Set(['Agendado', 'Aberto', 'Em deslocamento', 'No local', 'Aguardando cliente']);
  const MSG_SEM_TECNICO = 'Um usuário "Técnico" deve ser cadastrado para prosseguir';

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
      [...select.options].forEach((option) => {
        const valor = String(option.value || '').trim();
        const texto = String(option.textContent || '').trim();
        if (BLOQUEADOS_INTERNO.has(valor) || BLOQUEADOS_INTERNO.has(texto)) option.remove();
      });
    });
  }

  function ajustarTecnico() {
    const select = document.getElementById('f-tecnico');
    if (!select) return;
    [...select.options].forEach((option) => {
      if (!option.value) option.remove();
    });
    select.required = true;
    const existente = select.parentElement?.querySelector('[data-sem-tecnico]');
    if (!select.options.length) {
      select.disabled = true;
      if (!existente) select.insertAdjacentHTML('afterend', `<span class="stat-lbl" data-sem-tecnico>${MSG_SEM_TECNICO}</span>`);
    } else {
      select.disabled = false;
      if (existente) existente.remove();
    }
  }

  function ajustarLabelTecnico() {
    const select = document.getElementById('f-tecnico');
    if (!select) return;
    const label = select.parentElement?.querySelector('label');
    if (label) label.textContent = 'Técnico responsável *';
  }

  function aplicar() {
    limparOpcoesInternas();
    ajustarTecnico();
    ajustarLabelTecnico();
  }

  document.addEventListener('DOMContentLoaded', () => {
    aplicar();
    const observer = new MutationObserver(aplicar);
    observer.observe(document.body, { childList: true, subtree: true });

    const originalNewOS = window.newOS;
    if (typeof originalNewOS === 'function') {
      window.newOS = function () {
        const lista = typeof techniciansRef !== 'undefined' ? techniciansRef : [];
        if (!lista.length) {
          toast(MSG_SEM_TECNICO, 'err');
          return;
        }
        return originalNewOS();
      };
    }
  });
})();

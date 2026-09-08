// Endereço do back-end publicado no Render.
// Troque pela URL real depois que o serviço do Render estiver no ar
// (algo como: https://kuba-tech-backend.onrender.com)
const API_URL = 'https://kuba-tech.onrender.com/api';

// Carrega os ajustes visuais globais antes do restante do front-end.
(function carregarAjustesVisuais() {
  if (document.getElementById('dark-mode-fixes')) return;
  const link = document.createElement('link');
  link.id = 'dark-mode-fixes';
  link.rel = 'stylesheet';
  link.href = '../css/dark-mode-fixes.css';
  document.head.appendChild(link);
})();

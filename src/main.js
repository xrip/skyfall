import { Game } from './game.js';

function fatal(err) {
  console.error(err);
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:999;background:#0a0f17;color:#ffb144;font:14px/1.6 monospace;padding:32px;white-space:pre-wrap;overflow:auto';
  d.textContent = 'SKYFALL — ошибка запуска\n\n' + (err && (err.stack || err.message || err)) +
    '\n\nПроверьте консоль браузера (F12) и обновите страницу.';
  document.body.appendChild(d);
}

try {
  const game = new Game();
  window.SKYFALL = game;
  console.log('%c SKYFALL ', 'background:#ffb144;color:#1a1004;font-weight:bold', 'Остров загружен. WASD + мышь.');
} catch (err) {
  fatal(err);
}

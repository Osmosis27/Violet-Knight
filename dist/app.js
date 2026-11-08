const $ = id => document.getElementById(id);
let currentRoute = 'normal', gameURL = null, loadingPromise = null, session = 0, timeout;
const validRoute = value => value === 'normal' || value === 'weird';
function status(text, value) { $('load-label').textContent = text; if (value !== undefined) $('progress').value = value; }
function screen(id) { for (const name of ['title-screen', 'loading', 'game-host', 'result', 'error']) $(name).hidden = name !== id; }
async function loadGame() {
  if (gameURL) return gameURL;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const metaResponse = await fetch('runtime/game-manifest.json');
    if (!metaResponse.ok) throw new Error('Browser game files are missing. Run the build step first.');
    const { parts, totalBytes } = await metaResponse.json();
    let received = 0;
    const blobs = [];
    for (const part of parts) {
      const response = await fetch(`runtime/${part}`);
      if (!response.ok) throw new Error(`Could not load ${part}.`);
      const chunks = [];
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); received += value.length;
        status(`Loading Violet Knight… ${Math.round(received / totalBytes * 100)}%`, received / totalBytes * 100);
      }
      blobs.push(new Blob(chunks));
    }
    gameURL = URL.createObjectURL(new Blob(blobs, { type: 'application/octet-stream' }));
    return gameURL;
  })().catch(error => { loadingPromise = null; throw error; });
  return loadingPromise;
}
function fail(message) {
  clearTimeout(timeout); $('error-text').textContent = message; screen('error'); $('game-host').replaceChildren();
}
async function start(route = currentRoute) {
  if (!validRoute(route)) throw new Error('Unknown route.');
  currentRoute = route;
  const run = ++session;
  clearTimeout(timeout); $('game-host').replaceChildren(); document.body.classList.add('playing');
  screen('loading'); status('Preparing Violet Knight…', 0);
  $('route-name').textContent = route === 'weird' ? 'WEIRD ROUTE' : 'NORMAL ROUTE';
  $('menu').hidden = false; $('retry').hidden = true;
  try {
    await loadGame();
    if (run !== session) return;
    status('Entering the arena…', 100);
    const frame = document.createElement('iframe');
    frame.title = `Violet Knight — ${route} route`;
    frame.allow = 'autoplay; fullscreen; gamepad';
    frame.src = `runtime/?route=${route}`;
    frame.id = 'game-frame'; $('game-host').append(frame);
    timeout = setTimeout(() => { if (run === session) fail('The fight did not report that it started. Check the browser console for a game-data or runtime error.'); }, 90000);
  } catch (error) { if (run === session) fail(error.message); }
}
function menu() {
  session++; clearTimeout(timeout); $('game-host').replaceChildren(); screen('title-screen');
  document.body.classList.remove('playing'); $('route-name').textContent = '';
  $('retry').hidden = true; $('menu').hidden = true;
  document.querySelector(`[data-route="${currentRoute}"]`)?.focus();
}
window.violetHost = {
  getGameURL: () => gameURL,
  ready() { clearTimeout(timeout); screen('game-host'); $('retry').hidden = false; $('game-frame')?.contentWindow.focus(); },
  result(value) { clearTimeout(timeout); $('game-host').hidden = false; $('result').hidden = false; $('result-title').textContent = value === 'VICTORY' ? 'THE VIOLET KNIGHT FALLS.' : 'THE FIGHT IS NOT OVER.'; },
  error: fail,
  retry: () => start(),
  menu
};
for (const button of document.querySelectorAll('[data-route]')) button.addEventListener('click', () => start(button.dataset.route));
$('menu').onclick = menu; $('retry').onclick = () => start(); $('again').onclick = () => start(); $('choose').onclick = menu;
$('try-again').onclick = () => start(); $('error-menu').onclick = menu;
$('fullscreen').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else $('stage').requestFullscreen().catch(() => {}); };
document.addEventListener('keydown', event => {
  if (event.code === 'KeyR' && $('title-screen').hidden) { event.preventDefault(); start(); }
  else if (event.code === 'Escape' && $('title-screen').hidden) menu();
});

// TANEO Permitting Dashboard — soft access gate.
//
// IMPORTANT: This is NOT real security. The credentials are visible in this
// source file, the JSON data files can be fetched directly, and anyone with
// browser dev tools can bypass this in seconds. The gate exists only to keep
// casual visitors away while the beta is being polished. For real access
// control (e.g., before any sensitive data is added), put the site behind a
// Cloudflare Worker, Cloudflare Access, or a paid host's password feature.
(function () {
  const KEY = 'taneo-auth';
  const USER = 'TANEO';
  const PASS = 'LONESTAR';

  if (sessionStorage.getItem(KEY) === 'ok') return;

  // Hide existing body content until the user authenticates.
  const hideStyle = document.createElement('style');
  hideStyle.textContent = `
    body > *:not(.gate-overlay) { display: none !important; }
    .gate-overlay {
      position: fixed; inset: 0;
      background: var(--newsprint, #F5F2E8);
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      z-index: 9999;
    }
    .gate-card {
      max-width: 420px; width: 100%;
      background: var(--paper, #FDFCF9);
      border: 1px solid var(--ink, #1A1A1A);
      padding: 32px;
      font-family: var(--serif, "Source Serif 4", Georgia, serif);
    }
    .gate-card .gate-pub {
      font-family: var(--mono, "IBM Plex Mono", monospace);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--gray-70, #5C5C5C);
      margin: 0 0 6px 0;
    }
    .gate-card h1 {
      font-size: 22px;
      margin: 0 0 16px 0;
      border-bottom: 2px solid var(--ink, #1A1A1A);
      padding-bottom: 8px;
    }
    .gate-card p { font-size: 14px; line-height: 1.5; margin: 0 0 16px 0; }
    .gate-card label {
      display: block;
      font-family: var(--mono, "IBM Plex Mono", monospace);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--gray-70, #5C5C5C);
      margin-bottom: 14px;
    }
    .gate-card input {
      display: block;
      width: 100%;
      margin-top: 4px;
      padding: 8px 10px;
      font-family: var(--mono, "IBM Plex Mono", monospace);
      font-size: 14px;
      border: 1px solid var(--ink, #1A1A1A);
      background: var(--newsprint, #F5F2E8);
      color: var(--ink, #1A1A1A);
      box-sizing: border-box;
    }
    .gate-card input:focus-visible {
      outline: 2px solid var(--industrial-red, #8B2B2B);
      outline-offset: 2px;
    }
    .gate-card button {
      font-family: var(--mono, "IBM Plex Mono", monospace);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 10px 18px;
      background: var(--ink, #1A1A1A);
      color: var(--newsprint, #F5F2E8);
      border: 1px solid var(--ink, #1A1A1A);
      cursor: pointer;
    }
    .gate-card button:hover { background: var(--industrial-red, #8B2B2B); border-color: var(--industrial-red, #8B2B2B); }
    .gate-error {
      color: var(--industrial-red, #8B2B2B) !important;
      font-family: var(--mono, monospace);
      font-size: 12px;
    }
  `;
  document.documentElement.appendChild(hideStyle);

  function mount() {
    const overlay = document.createElement('div');
    overlay.className = 'gate-overlay';
    overlay.innerHTML = `
      <form class="gate-card" id="gate-form" autocomplete="off">
        <p class="gate-pub">Texas Advanced Nuclear Energy Office</p>
        <h1>Permitting Dashboard</h1>
        <p>Beta access. Enter the credentials shared with TANEO to continue.</p>
        <label>Username
          <input id="gate-user" type="text" required autocomplete="username">
        </label>
        <label>Password
          <input id="gate-pass" type="password" required autocomplete="current-password">
        </label>
        <p class="gate-error" id="gate-error" hidden>Incorrect credentials.</p>
        <button type="submit">Enter</button>
      </form>`;
    document.body.appendChild(overlay);
    document.getElementById('gate-user').focus();
    document.getElementById('gate-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const u = document.getElementById('gate-user').value.trim();
      const p = document.getElementById('gate-pass').value;
      if (u === USER && p === PASS) {
        sessionStorage.setItem(KEY, 'ok');
        location.reload();
      } else {
        document.getElementById('gate-error').hidden = false;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();

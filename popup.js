const master = document.getElementById('master');
const stateEl = document.getElementById('state');
const content = document.getElementById('content');

async function render() {
  const { rules, paused } = await chrome.storage.sync.get({ rules: [], paused: false });
  const now = new Date();

  master.checked = !paused;
  stateEl.textContent = paused ? 'Blocco disattivato' : 'Blocco attivo';
  stateEl.classList.toggle('on', !paused);

  if (paused) {
    content.innerHTML = '<p class="empty">Nessun sito viene bloccato finche\' l\'interruttore e\' spento.</p>';
    return;
  }

  const active = rules.filter((r) => isRuleActive(r, now));
  if (active.length === 0) {
    const enabled = rules.filter((r) => r.enabled).length;
    content.innerHTML = `<p class="empty">Nessun sito bloccato in questo momento.<br>
      ${enabled} regol${enabled === 1 ? 'a attiva' : 'e attive'}, ${rules.length} in totale.</p>`;
  } else {
    const domains = activeDomains(rules, now);
    content.innerHTML = `<p class="empty" style="color:var(--accent);font-weight:600">
      <span class="dot"></span>${domains.length} sit${domains.length === 1 ? 'o bloccato' : 'i bloccati'} ora</p>
      <ul>${active.map((r) => `<li><span>${escapeHtml(r.name || 'Senza nome')}</span>
        <span style="color:var(--muted)">${r.start}–${r.end}</span></li>`).join('')}</ul>`;
  }
}

master.addEventListener('change', async () => {
  await chrome.storage.sync.set({ paused: !master.checked });
  chrome.runtime.sendMessage({ type: 'refresh' }).catch(() => {});
  render();
});

document.getElementById('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

render();

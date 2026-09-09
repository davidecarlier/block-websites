const master = document.getElementById('master');
const stateEl = document.getElementById('state');
const content = document.getElementById('content');

localizePage();

async function render() {
  const { rules, paused } = await chrome.storage.sync.get({ rules: [], paused: false });
  const now = new Date();

  master.checked = !paused;
  stateEl.textContent = t(paused ? 'stateOff' : 'stateOn');
  stateEl.classList.toggle('on', !paused);

  if (paused) {
    content.innerHTML = `<p class="empty">${escapeHtml(t('pausedInfo'))}</p>`;
    return;
  }

  const active = rules.filter((r) => isRuleActive(r, now));
  if (active.length === 0) {
    const enabled = rules.filter((r) => r.enabled).length;
    const summary = tPlural(enabled, 'rulesSummaryOne', 'rulesSummaryMany', [String(enabled), String(rules.length)]);
    content.innerHTML = `<p class="empty">${escapeHtml(t('nothingBlockedNow'))}<br>${escapeHtml(summary)}</p>`;
  } else {
    const domains = activeDomains(rules, now);
    content.innerHTML = `<p class="empty" style="color:var(--accent);font-weight:600">
      <span class="dot"></span>${escapeHtml(tPlural(domains.length, 'sitesBlockedOne', 'sitesBlockedMany', [String(domains.length)]))}</p>
      <ul>${active.map((r) => `<li><span>${escapeHtml(r.name || t('unnamedRule'))}</span>
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

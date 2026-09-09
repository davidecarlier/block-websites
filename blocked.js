(async () => {
  const params = new URLSearchParams(location.search);
  const site = params.get('site') || 'Questo sito';
  document.getElementById('site').textContent = site;

  // L'URL originale è l'ultimo parametro e non è codificato (arriva da
  // regexSubstitution), quindi va preso "grezzo" dopo il primo "&url=".
  const marker = '&url=';
  const idx = location.search.indexOf(marker);
  const originalUrl = idx >= 0 ? location.search.slice(idx + marker.length) : null;

  if (originalUrl && /^https?:\/\//i.test(originalUrl)) {
    const box = document.getElementById('resume');
    const link = document.getElementById('link');
    link.href = originalUrl;
    link.textContent = originalUrl;
    box.hidden = false;
  }

  let timer = null;

  async function check() {
    clearTimeout(timer);
    const { rules, paused } = await chrome.storage.sync.get({ rules: [], paused: false });
    const now = new Date();
    const stillBlocked = !paused && activeDomains(rules, now).some(
      (d) => site === d || site.endsWith('.' + d)
    );

    if (!stillBlocked) {
      if (originalUrl) {
        document.getElementById('resume').classList.add('ready');
        document.getElementById('note').textContent = 'Blocco terminato, riapro la pagina...';
        setTimeout(() => location.replace(originalUrl), 1500);
      } else {
        document.getElementById('until').textContent = 'Il blocco e\' terminato: puoi riprovare ad aprire il sito.';
      }
      return;
    }

    const matching = rules.filter((r) => isRuleActive(r, now) && r.sites.map(normalizeDomain).includes(site));
    if (matching.length > 0) {
      const ends = matching.map((r) => r.end).sort();
      document.getElementById('until').textContent = `Sblocco previsto alle ${ends[ends.length - 1]}.`;
    }
    timer = setTimeout(check, 30000);
  }

  chrome.storage.onChanged.addListener(() => check());
  check();
})();

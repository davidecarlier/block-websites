importScripts('schedule.js');

const ALARM_NAME = 'refresh-blocks';
const RULE_ID_BASE = 1000;

// Cache in memoria dei domini attualmente bloccati (valida finche' il service
// worker resta vivo). Persistita anche in storage.session per i risvegli.
let cachedDomains = null;

chrome.runtime.onInstalled.addListener(async () => {
  const { rules } = await chrome.storage.sync.get({ rules: [] });
  if (rules.length === 0) {
    // Regola di esempio, disattivata, per mostrare il formato.
    await chrome.storage.sync.set({
      rules: [{
        id: crypto.randomUUID(),
        name: 'Orario di lavoro',
        sites: ['facebook.com', 'instagram.com', 'youtube.com'],
        days: [1, 2, 3, 4, 5],
        start: '09:00',
        end: '18:00',
        enabled: false
      }]
    });
  }
  refreshRules();
});

chrome.runtime.onStartup.addListener(() => refreshRules());

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) refreshRules();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.rules || changes.paused)) refreshRules();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'refresh') {
    refreshRules().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Intercetta solo i cambi di URL nei tab (navigazioni client-side delle single
// page app e pagine servite dalla cache di un service worker, es. x.com).
// Gli altri eventi di onUpdated (status, title, favicon...) vengono ignorati.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const domains = await getCachedDomains();
  if (domains.length === 0) return;
  const domain = blockedDomainFor(changeInfo.url, domains);
  if (domain) redirectTab(tabId, changeInfo.url, domain);
});

async function refreshRules() {
  const { rules, paused } = await chrome.storage.sync.get({ rules: [], paused: false });
  const now = new Date();
  const domains = paused ? [] : activeDomains(rules, now);

  const previous = await getCachedDomains();
  const changed = !sameSet(previous, domains);
  cachedDomains = domains;
  await chrome.storage.session.set({ domains });

  // Le regole DNR vengono riscritte solo se l'elenco dei domini e' cambiato.
  if (changed) {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing.map((r) => r.id);
    const blockedPage = chrome.runtime.getURL('blocked.html');
    const addRules = domains.map((domain, i) => ({
      id: RULE_ID_BASE + i,
      priority: 1,
      action: {
        type: 'redirect',
        // \0 e' l'intero URL originale: viene passato alla pagina di blocco
        // per poter riprendere la navigazione quando la fascia finisce.
        redirect: {
          regexSubstitution: `${blockedPage}?site=${encodeURIComponent(domain)}&url=\\0`
        }
      },
      condition: {
        // Dominio e tutti i sottodomini, qualsiasi percorso.
        regexFilter: `^https?://([^/]+\\.)?${escapeRegex(domain)}(/.*)?$`,
        resourceTypes: ['main_frame']
      }
    }));
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  }

  // Tab gia' aperti su un dominio bloccato: le regole DNR non li toccano.
  await enforceOnOpenTabs(domains);

  // Badge con il numero di siti bloccati in questo momento.
  if (paused) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#777' });
  } else {
    const count = domains.length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#d33' });
  }

  // Un solo alarm, al prossimo istante in cui l'elenco dei domini cambia.
  // Se non c'e' nessun cambio in vista, il service worker resta a riposo.
  const next = paused ? null : nextTransition(rules, now);
  if (next) {
    chrome.alarms.create(ALARM_NAME, { when: next.getTime() });
  } else {
    chrome.alarms.clear(ALARM_NAME);
  }
}

async function getCachedDomains() {
  if (cachedDomains) return cachedDomains;
  const { domains } = await chrome.storage.session.get({ domains: null });
  if (domains) {
    cachedDomains = domains;
    return domains;
  }
  // Primo avvio dopo un riavvio del browser: ricalcola dalle regole.
  const { rules, paused } = await chrome.storage.sync.get({ rules: [], paused: false });
  cachedDomains = paused ? [] : activeDomains(rules);
  return cachedDomains;
}

/** Reindirizza alla pagina di blocco tutti i tab che stanno su un dominio bloccato. */
async function enforceOnOpenTabs(domains) {
  if (domains.length === 0) return;
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const tab of tabs) {
    const domain = blockedDomainFor(tab.url, domains);
    if (domain) redirectTab(tab.id, tab.url, domain);
  }
}

/** Restituisce il dominio bloccato a cui appartiene l'URL, oppure null. */
function blockedDomainFor(url, domains) {
  if (!url || !/^https?:/i.test(url)) return null;
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  return domains.find((d) => host === d || host.endsWith('.' + d)) || null;
}

function redirectTab(tabId, url, domain) {
  const target = `${chrome.runtime.getURL('blocked.html')}?site=${encodeURIComponent(domain)}&url=${url}`;
  chrome.tabs.update(tabId, { url: target }).catch(() => {});
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

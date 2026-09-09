importScripts('schedule.js');

const ALARM_NAME = 'refresh-blocks';
const RULE_ID_BASE = 1000;

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
  scheduleAlarm();
  refreshRules();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleAlarm();
  refreshRules();
});

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

function scheduleAlarm() {
  chrome.alarms.get(ALARM_NAME, (existing) => {
    if (!existing) {
      // Ogni minuto, allineato al minuto successivo.
      const next = new Date();
      next.setSeconds(0, 0);
      next.setMinutes(next.getMinutes() + 1);
      chrome.alarms.create(ALARM_NAME, { when: next.getTime(), periodInMinutes: 1 });
    }
  });
}

async function refreshRules() {
  const { rules, paused } = await chrome.storage.sync.get({ rules: [], paused: false });
  const domains = paused ? [] : activeDomains(rules);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  const blockedPage = chrome.runtime.getURL('blocked.html');
  const addRules = domains.map((domain, i) => ({
    id: RULE_ID_BASE + i,
    priority: 1,
    action: {
      type: 'redirect',
      // \0 è l'intero URL originale: viene passato alla pagina di blocco
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

  // Badge con il numero di siti bloccati in questo momento.
  if (paused) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#777' });
  } else {
    const count = domains.length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#d33' });
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

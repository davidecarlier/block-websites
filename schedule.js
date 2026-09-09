// Logica condivisa per stabilire se una regola è attiva in un dato istante.
// Usata sia dal service worker che dalle pagine UI.

/** Converte "HH:MM" in minuti dalla mezzanotte. */
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Una regola ha la forma:
 * { id, sites: ['facebook.com', ...], days: [0..6] (0 = domenica), start: 'HH:MM', end: 'HH:MM', enabled: true }
 * Se end <= start la fascia attraversa la mezzanotte (es. 22:00 -> 06:00).
 */
function isRuleActive(rule, now = new Date()) {
  if (!rule.enabled) return false;
  if (!rule.sites || rule.sites.length === 0) return false;

  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(rule.start);
  const end = toMinutes(rule.end);

  if (start < end) {
    return rule.days.includes(day) && minutes >= start && minutes < end;
  }
  if (start === end) {
    // Stessa ora di inizio e fine = tutto il giorno.
    return rule.days.includes(day);
  }
  // Fascia notturna: attiva dopo "start" nel giorno selezionato,
  // oppure prima di "end" nel giorno successivo a uno selezionato.
  const prevDay = (day + 6) % 7;
  if (minutes >= start && rule.days.includes(day)) return true;
  if (minutes < end && rule.days.includes(prevDay)) return true;
  return false;
}

/** Restituisce l'elenco (senza duplicati) dei domini attualmente da bloccare. */
function activeDomains(rules, now = new Date()) {
  const set = new Set();
  for (const rule of rules) {
    if (isRuleActive(rule, now)) {
      for (const s of rule.sites) set.add(normalizeDomain(s));
    }
  }
  return [...set].filter(Boolean);
}

/** Pulisce l'input utente: rimuove protocollo, www., percorso, spazi. */
function normalizeDomain(input) {
  let d = String(input || '').trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split(/[\/?#:]/)[0];
  return d;
}

if (typeof module !== 'undefined') {
  module.exports = { isRuleActive, activeDomains, normalizeDomain, toMinutes };
}

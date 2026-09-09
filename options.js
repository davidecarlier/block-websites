const listEl = document.getElementById('rules');
const template = document.getElementById('rule-template');
const savedEl = document.getElementById('saved');
let rules = [];
let saveTimer = null;

async function load() {
  const data = await chrome.storage.sync.get({ rules: [] });
  rules = data.rules;
  render();
}

function render() {
  listEl.innerHTML = '';
  if (rules.length === 0) {
    listEl.innerHTML = '<p class="hint">Nessuna regola. Clicca "Nuova regola" per iniziare.</p>';
    return;
  }
  for (const rule of rules) listEl.appendChild(renderRule(rule));
}

function renderRule(rule) {
  const node = template.content.firstElementChild.cloneNode(true);
  const q = (sel) => node.querySelector(sel);

  q('.name').value = rule.name || '';
  q('.enabled').checked = !!rule.enabled;
  q('.sites').value = (rule.sites || []).join('\n');
  q('.start').value = rule.start || '09:00';
  q('.end').value = rule.end || '18:00';
  node.querySelectorAll('.days input').forEach((cb) => {
    cb.checked = (rule.days || []).includes(Number(cb.value));
  });
  updateStatus(node, rule);

  const commit = () => {
    rule.name = q('.name').value.trim();
    rule.enabled = q('.enabled').checked;
    rule.sites = q('.sites').value
      .split(/[\n,]/)
      .map(normalizeDomain)
      .filter(Boolean);
    rule.start = q('.start').value || '00:00';
    rule.end = q('.end').value || '00:00';
    rule.days = [...node.querySelectorAll('.days input:checked')].map((cb) => Number(cb.value));
    updateStatus(node, rule);
    scheduleSave();
  };

  node.querySelectorAll('input, textarea').forEach((el) => {
    el.addEventListener('input', commit);
    el.addEventListener('change', commit);
  });

  q('.delete').addEventListener('click', () => {
    if (!confirm('Eliminare questa regola?')) return;
    rules = rules.filter((r) => r.id !== rule.id);
    render();
    scheduleSave();
  });

  return node;
}

function updateStatus(node, rule) {
  const el = node.querySelector('.status');
  const active = isRuleActive(rule);
  el.textContent = active ? 'Bloccando ora' : (rule.enabled ? 'In attesa' : 'Disattivata');
  el.classList.toggle('on', active);
  node.classList.toggle('active', active);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
}

async function save() {
  await chrome.storage.sync.set({ rules });
  chrome.runtime.sendMessage({ type: 'refresh' }).catch(() => {});
  savedEl.classList.add('show');
  setTimeout(() => savedEl.classList.remove('show'), 1200);
}

document.getElementById('add').addEventListener('click', () => {
  rules.push({
    id: crypto.randomUUID(),
    name: '',
    sites: [],
    days: [1, 2, 3, 4, 5],
    start: '09:00',
    end: '18:00',
    enabled: true
  });
  render();
  scheduleSave();
  listEl.lastElementChild.querySelector('.name').focus();
});

// Aggiorna gli indicatori di stato ogni 30 secondi.
setInterval(() => {
  [...listEl.children].forEach((node, i) => {
    if (rules[i]) updateStatus(node, rules[i]);
  });
}, 30000);

load();

// Helper condiviso per la localizzazione delle pagine HTML.
// Il manifest viene tradotto automaticamente da Chrome (__MSG_chiave__);
// per HTML e JS serve chrome.i18n.getMessage, quindi:
//  - data-i18n="chiave"             -> textContent
//  - data-i18n-placeholder="chiave" -> attributo placeholder
//  - data-i18n-title="chiave"       -> attributo title

function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

/** Sceglie la variante singolare/plurale (chrome.i18n non gestisce i plurali). */
function tPlural(count, oneKey, manyKey, substitutions) {
  return t(count === 1 ? oneKey : manyKey, substitutions);
}

function localizePage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  const lang = chrome.i18n.getUILanguage();
  if (lang) document.documentElement.lang = lang;
}

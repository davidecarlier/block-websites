# Blocco Siti a Orari

Estensione Chrome (Manifest V3) che blocca un elenco di siti in fasce orarie e giorni configurabili.

## Installazione

1. Apri `chrome://extensions`
2. Attiva **Modalita sviluppatore** (in alto a destra)
3. Clicca **Carica estensione non pacchettizzata** e seleziona questa cartella

## Uso

- Clicca l'icona dell'estensione: l'interruttore in alto spegne e riaccende tutto il blocco al volo (badge "OFF" quando è spento). Da li' **Gestisci regole** (oppure tasto destro > Opzioni).
- Ogni regola ha: nome, elenco di siti, orario "Dalle / Alle", giorni della settimana e un interruttore Attiva.
- I sottodomini vengono bloccati automaticamente (`facebook.com` blocca anche `m.facebook.com`).
- Se "Alle" è precedente a "Dalle" la fascia attraversa la mezzanotte (es. 22:00 -> 06:00).
- La pagina di blocco mostra il link alla pagina che stavi visitando e la riapre da sola quando la fascia finisce.
- Le regole si sincronizzano tra i tuoi Chrome tramite `chrome.storage.sync`.

## Come funziona

Il service worker calcola quali siti sono in fascia di blocco e aggiorna le regole dinamiche di
`declarativeNetRequest`, che reindirizzano la navigazione verso `blocked.html`. Poi programma un solo
alarm al prossimo cambio di fascia e resta a riposo: niente timer periodici.
In piu' controlla i tab aperti (`chrome.tabs`) e reindirizza anche quelli: serve per i tab gia' aperti
quando inizia la fascia e per i siti serviti dal proprio service worker (es. x.com), che non passano dalla rete.
Il badge sull'icona mostra quanti siti sono bloccati in questo momento.

## File

- `manifest.json` – configurazione estensione
- `background.js` – service worker: alarm + regole DNR
- `schedule.js` – logica condivisa degli orari
- `options.html/js` – pagina di configurazione
- `popup.html/js` – popup con lo stato corrente
- `blocked.html/js` – pagina mostrata al posto del sito bloccato
- `i18n.js` – helper che traduce le pagine HTML (`data-i18n`, `data-i18n-placeholder`, `data-i18n-title`)
- `_locales/<lingua>/messages.json` – stringhe tradotte

## Traduzioni

L'estensione usa `chrome.i18n`: la lingua segue quella dell'interfaccia di Chrome, con fallback
sull'italiano (`default_locale`). Sono incluse italiano (`it`) e inglese (`en`).

Per aggiungere una lingua copia `_locales/en/messages.json` in `_locales/<codice>/messages.json`
e traduci i valori `message`, lasciando invariate le chiavi e i placeholder (`$COUNT$`, `$TIME$`...).

Per provare un'altra lingua avvia Chrome con `--lang=en` oppure cambia la lingua in `chrome://settings/languages`.

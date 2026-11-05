# Bridge per Noi By ATA – prova Firebase

## Pubblicazione
Caricare il contenuto di questa cartella nel repository GitHub Pages, mantenendo le cartelle `css/` e `js/` e il file `index.html` nella radice pubblicata.

## Configurazione
`js/firebase-config.js` contiene la configurazione Web del progetto Firebase `bridge-per-noi-71d08` e il suo URL Realtime Database.

## Come provare il collegamento tra due computer
1. Aprire il sito pubblicato in due browser/dispositivi distinti.
2. Sul primo scegliere **Un tavolo con amici**, inserire un codice di 5 cifre e un nickname, confermare e occupare un posto.
3. Sul secondo usare lo stesso codice, inserire un nickname e confermare: i posti già occupati dovrebbero apparire disabilitati con il nickname.
4. Occupare un altro posto dal secondo dispositivo. Sul primo il nome dovrebbe aggiornarsi senza ricaricare la pagina.

## Importante: sicurezza e limiti della versione di prova
- Le regole Firebase attuali consentono lettura e scrittura pubbliche fino al 3 dicembre 2026: sono esclusivamente per test. Non pubblicare dati personali o sensibili.
- Prima di un uso pubblico occorre aggiungere autenticazione e regole di sicurezza con validazione dei dati.
- Questo intervento corregge il caricamento remoto del tavolo tramite codice e la sottoscrizione realtime dei dati. Non costituisce ancora una certificazione completa di tutte le azioni di gioco concorrenti: prima di invitare altri giocatori bisogna collaudare distribuzione, licite, carte giocate, uscita/riconnessione e cancellazione del tavolo su più dispositivi.
- La cancellazione automatica quando tutti i posti sono vuoti segue il flusso di uscita del gioco; una chiusura improvvisa della scheda o una perdita di rete non equivale necessariamente a un'uscita ordinata. Per gestire anche questi casi serve una presenza server-side affidabile (ad esempio autenticazione e gestione `onDisconnect`).

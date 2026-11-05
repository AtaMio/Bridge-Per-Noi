# Bridge per Noi By ATA – Firebase/GitHub (integrazione iniziale)

## Contenuto
- Firebase Realtime Database collegato al progetto `bridge-per-noi-71d08`.
- Adapter `js/firebase-sync.js`: sincronizza i record `bridge_table_*` dal localStorage al nodo Firebase `bridgeTables` e ascolta aggiornamenti remoti.
- La pagina iniziale mantiene le due modalità richieste e il titolo By ATA.

## Pubblicazione GitHub Pages
1. Estrai lo ZIP.
2. Carica nel repository GitHub tutti i file e le cartelle contenuti in `Bridge_per_Noi_v10-04` (non la cartella ZIP stessa).
3. Repository → Settings → Pages → Deploy from a branch → `main` / root → Save.
4. Apri l'URL Pages in HTTPS; Firebase non funziona correttamente su `file://`.

## ATTENZIONE – prima del test con amici
Le regole Firebase attualmente in modalità test permettono a chiunque di leggere/scrivere fino alla data indicata. Non pubblicizzare né usare dati personali/privati in questa fase. Prima dell'uso reale occorre implementare autenticazione Firebase e regole per utente/tavolo.

Questa è un'integrazione iniziale di sincronizzazione. Va collaudata su due browser e quattro giocatori: la sincronizzazione simultanea di azioni (aste/carte) e la gestione robusta di presenza/disconnessione richiedono ancora un passaggio di hardening. La cancellazione del tavolo al completo svuotamento dei posti dipende dalla logica attuale di uscita; non è ancora una presenza server-side affidabile in caso di chiusura improvvisa del browser.

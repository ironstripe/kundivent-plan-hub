# Benutzer anlegen: Speichern bricht unbemerkt ab

## Ursache (bestätigt)

Im Screenshot steht als initiales Passwort „Test123" – das sind **7 Zeichen**. Die Benutzerverwaltung verlangt mindestens 8. Das Formular bricht deshalb bereits im Browser ab; es wird gar keine Anfrage an den Server geschickt. Das passt exakt zum Befund: kein Anlege-Vorgang in den Protokollen und kein Konto für Giacomo Zeta in der Datenbank – nur `test@kundivent.ch` und `probe@kundivent.ch`.

Die Fehlermeldung „Das initiale Passwort muss mindestens 8 Zeichen lang sein." wird zwar gesetzt, steht aber weit unten im scrollbaren Formularbereich und ist beim Klick auf „Speichern" oft ausserhalb des Sichtbereichs. Für dich sieht das aus wie „Speichern tut nichts".

## Was geändert wird

1. **Fehler unübersehbar machen**
   - Fehlermeldungen erscheinen zusätzlich als Einblendung (Toast) oben, nicht nur inline.
   - Der Formularbereich scrollt bei einem Fehler automatisch zur Meldung, und das betroffene Feld wird rot markiert und fokussiert.

2. **Fehler früher zeigen statt erst beim Speichern**
   - Unter dem Passwortfeld eine Live-Anzeige: „7 / mind. 8 Zeichen" – rot, solange zu kurz.
   - Der Speichern-Button bleibt klickbar (damit Fehler erklärt werden), zeigt aber sofort, was fehlt.

3. **Passwortkomfort**
   - Button „Passwort generieren" erzeugt ein gültiges Startpasswort (12 Zeichen) und ein Kopieren-Symbol legt es in die Zwischenablage – damit Admins nicht an der Mindestlänge scheitern.

4. **Erfolg verlässlich bestätigen**
   - Erfolgsmeldung erst, wenn der neue Benutzer in der neu geladenen Liste tatsächlich auftaucht; sonst bleibt der Drawer mit Fehlertext offen.

5. **Konto anlegen und testen**
   - Anschliessend Giacomo Zeta (`giacomo.zeta@kundelfingerhof.ch`) mit einem gültigen Startpasswort anlegen, Login inkl. erzwungenem Passwortwechsel im Browser durchtesten und das Testkonto `probe@kundivent.ch` entfernen.

## Technische Details

- Betroffen: `src/components/kundivent/user-admin.tsx` (Validierung, Fehleranzeige, Scroll-to-Error, Passwortgenerator), ggf. `src/lib/users.ts` (Invalidierung vor Erfolgsmeldung abwarten).
- Keine Datenbank- oder Schemaänderung nötig; Anlege-Logik und Rechteprüfung sind in Ordnung.
- Verifikation per Browser-Durchlauf gegen die Vorschau inkl. Netzwerkmitschnitt.

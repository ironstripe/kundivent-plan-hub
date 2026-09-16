# KundiCalc-Zuordnung für Jürgen Solms

Die KundiCalc-Benutzerkennung `19553469-2718-4b58-b822-bf0b7c4cf4d0` wird dem
Kundivent-Konto von Jürgen Solms (solms@kundelfingerhof.ch) zugeordnet, damit
Übergaben aus KundiCalc unter seinem Namen angenommen werden.

## Ausgangslage (geprüft)

- Jürgen Solms ist in Kundivent aktiv und hat Administratorrechte – damit ist er
  grundsätzlich berechtigt, Einträge aus KundiCalc zu übergeben.
- Für ihn besteht bisher keine KundiCalc-Zuordnung.
- Die Kennung `19553469-…` ist aktuell keinem anderen Benutzer zugeordnet.
- Bestehende Zuordnung von Ivo Streiff (marketing@kundelfingerhof.ch) bleibt
  unverändert.

## Was gemacht wird

1. Neue, aktive Zuordnung anlegen: KundiCalc-Kennung
   `19553469-2718-4b58-b822-bf0b7c4cf4d0` → Jürgen Solms, mit Notiz
   „solms@kundelfingerhof.ch“.
2. Kontrolle, dass die Zuordnung in beiden Ansichten erscheint – Einstellungen →
   „KundiCalc-Übergabe“ und im Benutzer-Bearbeiten-Fenster unter
   „KundiCalc-Verknüpfung“.
3. Lesender Test der Schnittstelle mit dieser Kennung: Abruf der Stammdaten
   (Kategorien und Planungsbereiche). Es werden dabei keine Einträge angelegt
   und der Kalender bleibt unverändert.

## Nicht Teil dieser Änderung

- Keine Änderung an Rollen, Aktivierung oder Rechten.
- Keine Änderung am Schnittstellen-Vertrag oder an bestehenden Übergabe-Quittungen.
- Keine Testeinträge im Kalender.

## Technische Details

Ein Datensatz in `integration_user_map`: `source_system = 'kundicalc'`,
`source_actor_id = '19553469-2718-4b58-b822-bf0b7c4cf4d0'`,
`profile_id = '85ed8581-fa6c-4e96-b89d-d91ba2907b58'`, `active = true`.
Die Eindeutigkeit über (source_system, source_actor_id) verhindert doppelte
Vergabe. Verifikation per GET auf
`/api/public/integrations/kundicalc/v1/master-data` mit gültigem Schlüssel und
dem neuen Actor-Header (erwartet: 200).

## Offene Einschränkung

Eine echte Übergabe aus KundiCalc kann von hier aus nicht ausgelöst werden; die
App-zu-App-Verbindung bleibt bis zu einem echten Aufruf unbestätigt.

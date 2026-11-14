# Findings: Arbeitsblatt mit `src/editor`

## Ergebnis

Demo bildet vier Modi des zweiten Versuchs ab: Inhalt bearbeiten, Aufgaben beantworten, Feedback vergeben, Feedback ansehen. Sie übernimmt Aufgaben, Fixture, Bewertung, ProseKit-UI, CSS und Snapshot-Regeln aus `2026-11-09-second-attempt-with-pi`. Nur aktuelles Dokument ist schreibbar; beim Wechsel wird ein neuer Worksheet-Store geöffnet. Rückkehr zum Inhalt löscht Antworten und Feedback, Rückkehr zum Beantworten löscht Feedback. E2E prüft Bearbeiten, Bewerten, Überschreiben, Vorschau, Rücksprünge und unbeantwortete Aufgaben.

## Änderungen gegenüber zweitem Versuch

- UI-Dateien aus `editor/blocks` und `editor/components` liegen jetzt als Anwendungscode unter `src/demo/worksheet/`. Imports verweisen auf **vorhandenen** `src/editor`-Kern; alte Kernimplementierung wurde nicht kopiert. Fixture und Stile wurden übernommen; Font-Pfad und Stylesheet-Links angepasst.
- `src/demo/App.tsx`: neue `openWorksheet`-Signatur (`createStore`, `feedbacksSchema`, `feedbacks`), Worksheet-Subscription statt Store-Subscription und `dispose()` beim Wechsel/Unmount. Bisherige Snapshot-Resets bleiben bewusst im App-Code.
- `src/demo/worksheet/components/Editor.tsx`: `WorksheetRevisionProvider` sorgt für Aktualisierungen aus aktivem Store. Text-Block erhält `.exercise--text` für E2E-Selektor; Toolbar zeigt „Fett“/„Kursiv“ statt „B“/„I“ gemäß Test des dritten Versuchs. Kein sonstiger geplanter Verhaltenswechsel.
- `src/editor/schema/record.ts`: lesendes `get(key)` ergänzt. Anders als `getOrCreate` schreibt es keine fehlenden Einträge in schreibgeschützte Dokumente.
- `src/editor/schema/exercise.tsx`: Antworten nur im Antwortmodus anlegen, Feedback nur im Bewertungsmodus anlegen. Fehlende Antworten/Feedbacks in anderen Modi über schreibgeschützte Schema-Defaults darstellen; auch übersprungene Aufgaben können bewertet werden, **ohne** Antworten zu persistieren. Typabweichungen bleiben Fehler.
- `src/editor/schema/discriminated-union.ts`: Constraint auf `TaggedObjectDefinition<string, {}>` eingeschränkt. Sonst lassen sich Block-Definitionen mit eigenen Feldern nicht als Union verwenden (`StoredBlock` inkompatibel mit `StoredTaggedObject<string, ObjectFields>`).
- `package.json`: Paketnamen vom zweiten auf den dritten Versuch berichtigt.
- `e2e/worksheet.e2e.ts`: Erwartung für übersprungene Antworten von `{ gaps: {}, choices: {} }` auf `{}` korrigiert. Fehlende Antworten werden bewusst nicht gespeichert; bisherige Erwartung widersprach dem Testnamen und Verhalten des zweiten Versuchs.

## Was `src/editor` erschwert

- `exercise()` verwendete `getOrCreate` auch auf schreibgeschützten Antworten und in der Ansicht auf Feedback. Fehlende Einträge warfen bei übersprungenen Aufgaben statt Defaults zu rendern. `record()` bot nur mutierendes `getOrCreate`, keinen lesenden Zugriff.
- `discriminatedUnion()`-Constraint war zu weit (`ObjectFields`); Feldtypen von Blocks kollabierten bei der Kombination zu inkompatiblen Typen. Ein tragfähiger gemeinsamer Typ für Block- und Tagged-Object-Definitionen fehlt.
- `useWorksheetSession` übernimmt Snapshots ungefiltert; produktspezifische Reset-Regeln für Rücksprünge müssen außen implementiert werden. Seine Store-Factory und der schreibbare Store pro Dokument erfordern neue Verdrahtung gegenüber dem gemeinsamen Root des Vorgängers.
- Default-`Worksheet`-Context-Typ ist an getaggte Antwort-/Feedback-Records gekoppelt; Gesamtfeedback muss als künstlicher `__overall`-Eintrag im Feedback-Record wohnen. Unterschiedliche Dokumentformen lassen sich nicht frei über diesen Context verwenden.
- Schreibgeschützte Rich-Text-Werte erzeugen ProseMirror-Editoren, auch für statische Vorschau und Default-Antworten. `Worksheet.dispose()` gibt nur den aktiven Store frei, nicht die intern erzeugten Readonly-Stores. Leichtgewichtige Reader und vollständige Lifecycle-Verwaltung fehlen.
- Statisches Rich Text und Lücken-Vorschau müssen manuell aus ProseMirror-JSON ins DOM serialisiert werden; es gibt dafür keine View-Komponente im Kern. Änderungen an Lücken-IDs oder Mark-Serialisierung können Antwortzuordnung beschädigen.

## Was `src/editor` erleichtert

- `openWorksheet` trennt schreibbaren und schreibgeschützte Dokumente bereits nach Modus; `createStore` ermöglicht Flat- und Yjs-Backend ohne eigene Storage-Fassade.
- Schema-Builder (`block`, `exercise`, `richText`, `array`, `record`) und `BlockView` übernehmen Identitäten, Snapshots, Schema-Bindung und Block-Rendering. `exercise.grade` koppelt automatische Bewertung an Feedback-Initialisierung.
- `WorksheetRevisionProvider`/Subscription und `dispose()` vereinfachen Re-Rendering und Store-Wechsel. Readonly-Store verhindert Mutationen, statt nur Eingabefelder zu deaktivieren.
- ProseKit-Rich-Text-Definition unterstützt stabile Gap-IDs samt DOM-Serialisierung bereits; Formatierung und Editorinstanzen werden vom Kern bereitgestellt.

Debug-JSON enthält Lösungen; Schreibschutz ist keine Zugriffskontrolle. Demo hat weder persistente Speicherung noch kollaborative Sessions oder atomare Speicherung über Dokumente hinweg.

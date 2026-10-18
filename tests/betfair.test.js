const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-10-18T12:00:00");
const HEADER = ["Piazzata", "Chiusa", "Dettagli", "Tipo", "Quota", "Puntata", "Responsabilità", "Profitto/Perdita"];
const ROW = ["13-ott-26 13:19:43", "13-ott-26 15:02:10", "Roma - Lazio Under 3,5 goal-Over/Under 3,5 gol | ID scommessa Betfair 1:123", "Punta", "1,52", "10,00", "--", "5,20"];

test("CSV di Betfair con la virgola", () => {
    const csv = [HEADER, ROW].map(r => r.map(f => `"${f}"`).join(",")).join("\r\n");
    const rows = app.parseCSV(csv);
    assert.equal(rows.length, 2);
    assert.deepEqual(app.betfairColumns(rows[0]).missing, []);
    assert.equal(rows[1][4], "1,52");
});

test("CSV risalvato da Excel in italiano (punto e virgola, numeri senza virgolette)", () => {
    const csv = "﻿" + [HEADER, ROW].map(r => r.join(";")).join("\r\n");
    const rows = app.parseCSV(csv);
    assert.deepEqual(app.betfairColumns(rows[0]).missing, []);
    assert.equal(rows[1].length, HEADER.length);
    assert.equal(app.itNumber(rows[1][7]), 5.2);
});

test("colonne mancanti: dico quali", () => {
    const { missing } = app.betfairColumns(["Data", "Riferimento", "Descrizione", "Importo"]);
    assert.ok(missing.includes("details") && missing.includes("pl"));
});

test("dettagli vuoti non bloccano l'importazione", () => {
    assert.equal(app.parseBetfairDetails(undefined).betId, null);
    assert.equal(app.parseBetfairDetails(ROW[2]).betId, "1:123");
});

test("date con mesi in italiano e in inglese", () => {
    assert.equal(app.itDate("13-ott-26 13:19:43").getMonth(), 9);
    assert.equal(app.itDate("13-Oct-26 13:19:43").getMonth(), 9);
});

test("file Movimenti chiusi: una riga per mercato, profitto col punto", () => {
    const csv = [
        "S.No;Palinsesto;Avvenimento;Sport;Manifestazione;Descrizione;Data;Mercato;Profitto;Totale",
        "1;36421;4497;CALCIO;Serie B;Ascoli - Empoli;2026-10-17T15:00:00;Under And Over 2.5;3.30;",
        "2;36421;1162;CALCIO;Serie A;Venezia - Napoli;2026-10-17T15:00:00;Esito Finale 1x2 ;-0.99;",
        "3;36421;1164;CALCIO;Serie A;Udinese - Lecce;2026-10-18T12:30:00;Under And Over 3.5;3.58;12.64"
    ].join("\n");
    const ops = app.parseMovimentiChiusi(app.parseCSV(csv));
    assert.equal(ops.length, 3);
    assert.equal(ops[0].name, "Under/Over 2.5");
    assert.equal(ops[0].pl, 3.3);
    assert.equal(ops[1].name, "Esito Finale 1x2");
    assert.equal(ops[1].pl, -0.99);
    assert.equal(ops[0].betfairIds[0], "mov:36421:4497:Under And Over 2.5");
    assert.equal(app.parseMovimentiChiusi(app.parseCSV("Piazzata,Chiusa\n1,2")), null);
});

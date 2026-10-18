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

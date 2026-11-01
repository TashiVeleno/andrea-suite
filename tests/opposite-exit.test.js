const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-11-01T10:00:00");
const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("uscita con l'esito contrario: Punta Under 10 € a 1,34, esco Punta Over 2,73 € a 4,90", () => {
    const eq = app.oppositeExit(4.9, 2.73);
    close(eq.odds, 4.9 / 3.9, 0.0001);   // ≈ 1,256 = bancare Under
    close(eq.stake, 2.73 * 3.9, 0.0001); // 10,647 di bancata
    const t = app.tradeResult("back", 10, 1.34, eq.odds, eq.stake, 0);
    close(t.ifWins, 0.67);  // finisce Under: +3,40 − 2,73
    close(t.ifLoses, 0.65); // finisce Over: +10,65 − 10
    close(t.pl, 0.65);
});

test("uscita contraria in pari: la puntata contraria è puntata × quota ÷ quota contraria", () => {
    const eq = app.oppositeExit(4.9, 0);
    assert.equal(eq.stake, 0);
    const t = app.tradeResult("back", 10, 1.34, eq.odds, 0, 0);
    close(t.amount / (4.9 - 1), 10 * 1.34 / 4.9); // ≈ 2,73 di Over
    close(t.ifWins, t.ifLoses);
});

test("uscita contraria per una banca: banco Over e chiudo bancando Under", () => {
    // Banca Over 2.5 a quota 2 con responsabilità 10 (bancata 10), poi banco Under a 2,5 con bancata 6
    const eq = app.oppositeExit(2.5, 6);
    const t = app.tradeResult("lay", 10, 2, eq.odds, eq.stake, 0);
    close(t.ifWins, -10 + 6);       // Over passa: perdo 10, vinco la bancata Under 6
    close(t.ifLoses, 10 - 6 * 1.5); // Under: vinco 10, pago 9
});

test("quota contraria mancante o non valida: nessuna uscita", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(app.oppositeExit(0, 5))), { odds: 0, stake: 0 });
    assert.equal(app.tradeResult("back", 10, 1.34, app.oppositeExit(1, 5).odds, 0, 0), null);
});

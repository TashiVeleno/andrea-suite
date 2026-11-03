const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-11-03T12:00:00");
const plain = v => JSON.parse(JSON.stringify(v));
const old = { manualDeposits: 150, manualWithdrawals: 0, deletedDeposits: 20, deletedWithdrawals: 0 }; // salvato prima del contatore

test("Allinea storico: la cifra nuova si somma al totale salvato", () => {
    let rl = app.addManualEntry(old, "deposit", 100, "2026-11-03", "a");
    rl = app.addManualEntry(rl, "withdraw", 40.5, "2026-11-03", "b");
    rl = plain(rl);
    assert.equal(rl.manualDeposits, 250);
    assert.equal(rl.manualWithdrawals, 40.5);
    assert.equal(rl.deletedDeposits, 20); // i progetti eliminati restano com'erano
    assert.deepEqual(rl.manualLog, [
        { id: "a", date: "2026-11-03", type: "deposit", amount: 100 },
        { id: "b", date: "2026-11-03", type: "withdraw", amount: 40.5 }
    ]);
    assert.equal(old.manualDeposits, 150); // l'originale non viene toccato
});

test("Allinea storico: cifre vuote o negative non cambiano nulla", () => {
    assert.equal(plain(app.addManualEntry(old, "deposit", 0, "2026-11-03", "x")).manualDeposits, 150);
    assert.equal(plain(app.addManualEntry(old, "deposit", -50, "2026-11-03", "x")).manualDeposits, 150);
});

test("Allinea storico: 🗑️ toglie l'aggiunta dal totale", () => {
    const rl = app.addManualEntry(old, "deposit", 100, "2026-11-03", "a");
    const back = plain(app.removeManualEntry(rl, "a"));
    assert.equal(back.manualDeposits, 150);
    assert.deepEqual(back.manualLog, []);
});

test("Allinea storico: la correzione porta il totale alla cifra giusta e si può annullare", () => {
    const fixed = app.addManualEntry(old, "deposit", 120 - 150, "2026-11-03", "f", true);
    assert.equal(plain(fixed).manualDeposits, 120);
    assert.equal(plain(fixed).manualLog[0].fix, true);
    assert.equal(plain(app.removeManualEntry(fixed, "f")).manualDeposits, 150);
});

test("Allinea storico: aggiunte fatte su telefono e PC si sommano tutte e due", () => {
    const base = app.addManualEntry(old, "deposit", 0, "", "z"); // stesso formato, nessuna aggiunta
    const phone = app.addManualEntry(base, "deposit", 100, "2026-11-03", "p");
    const pc = app.addManualEntry(base, "deposit", 50, "2026-11-03", "c");
    const merged = plain(app.mergeRealLife(base, phone, pc));
    assert.equal(merged.manualDeposits, 300);
    assert.deepEqual(merged.manualLog.map(e => e.id).sort(), ["c", "p"]);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-10-22T12:00:00");
const plain = v => JSON.parse(JSON.stringify(v));

const project = () => ({
    id: 1, name: "Test", capital: 500, goal: 1000,
    createdAt: "2026-10-01T08:00:00.000Z", endDate: "2027-10-01",
    movements: [
        { id: 1, type: "deposit", amount: 500, date: "2026-10-01T08:00:00.000Z" },
        { id: 2, type: "day", balance: 520, deposit: 0, withdraw: 0, date: "2026-10-02T20:00:00.000Z" },
        { id: 3, type: "withdraw", amount: 50, date: "2026-10-03T20:00:00.000Z" },
        { id: 4, type: "day", balance: 480, deposit: 0, withdraw: 0, date: "2026-10-04T20:00:00.000Z" }
    ]
});

test("correggere il saldo di un resoconto ricalcola G/P, saldo e risultato", () => {
    const p = project();
    const err = app.applyMovementEdit(p, 2, { date: p.movements[1].date, balance: "530", deposit: "", withdraw: "" });
    assert.equal(err, "");
    const stats = app.calculateProject(p);
    const h = id => stats.history.find(x => x.id === id);
    assert.equal(h(2).dayDiff, 30);
    assert.equal(h(4).dayDiff, 0);   // 530 - 50 di prelievo = 480: il giorno dopo è in pari
    assert.equal(stats.balance, 480);
    assert.equal(stats.result, 30);
    assert.equal(p.movements[1].id, 2); // stesso id: la sincronizzazione lo riconosce
});

test("correggere l'importo di un prelievo cambia saldo e risultato del giorno dopo", () => {
    const p = project();
    assert.equal(app.applyMovementEdit(p, 3, { date: p.movements[2].date, amount: "100" }), "");
    const stats = app.calculateProject(p);
    assert.equal(stats.history.find(x => x.id === 3).balanceAfter, 420);
    assert.equal(stats.history.find(x => x.id === 4).dayDiff, 60);
    assert.equal(stats.withdrawals, 100);
});

test("resoconto con depositi e prelievi corretti", () => {
    const p = project();
    assert.equal(app.applyMovementEdit(p, 4, { date: p.movements[3].date, balance: "480", deposit: "20", withdraw: "10" }), "");
    assert.deepEqual(plain(p.movements[3]), { id: 4, type: "day", balance: 480, deposit: 20, withdraw: 10, date: "2026-10-04T20:00:00.000Z" });
    assert.equal(app.calculateProject(p).history.find(x => x.id === 4).dayDiff, 0); // 480 - 470 + 10 - 20
});

test("spostare la data riordina lo storico", () => {
    const p = project();
    assert.equal(app.applyMovementEdit(p, 3, { date: "2026-10-05T10:00:00.000Z", amount: "50" }), "");
    const stats = app.calculateProject(p);
    assert.deepEqual(plain(stats.history.map(x => x.id)), [1, 2, 4, 3]);
    assert.equal(stats.history.find(x => x.id === 4).dayDiff, -40);
    assert.equal(stats.balance, 430);
});

test("deposito: importo e saldo trasferito si possono correggere", () => {
    const p = project();
    assert.equal(app.applyMovementEdit(p, 1, { date: p.movements[0].date, amount: "600", transfer: true }), "");
    assert.equal(p.movements[0].amount, 600);
    assert.equal(p.movements[0].transfer, true);
    assert.equal(app.applyMovementEdit(p, 1, { date: p.movements[0].date, amount: "600", transfer: false }), "");
    assert.equal("transfer" in p.movements[0], false);
});

test("valori non validi: errore e nessuna modifica", () => {
    const p = project();
    const before = plain(p);
    assert.match(app.applyMovementEdit(p, 2, { date: p.movements[1].date, balance: "" }), /saldo valido/);
    assert.match(app.applyMovementEdit(p, 2, { date: p.movements[1].date, balance: "-5" }), /saldo valido/);
    assert.match(app.applyMovementEdit(p, 3, { date: p.movements[2].date, amount: "0" }), /importo valido/);
    assert.match(app.applyMovementEdit(p, 3, { date: "", amount: "50" }), /data valida/);
    assert.match(app.applyMovementEdit(p, 3, { date: p.movements[2].date, amount: "999" }), /più del saldo/);
    assert.match(app.applyMovementEdit(p, 1, { date: "2026-10-10T08:00:00.000Z", amount: "500" }), /primo movimento/);
    assert.match(app.applyMovementEdit(p, 99, { date: "2026-10-10T08:00:00.000Z", amount: "1" }), /non trovato/);
    assert.deepEqual(plain(p), before);
});

test("modifica su un dispositivo e nuovo movimento sull'altro: la sincronizzazione tiene entrambi", () => {
    const base = [project()];
    const phone = plain(base);
    app.applyMovementEdit(phone[0], 2, { date: phone[0].movements[1].date, balance: "530", deposit: "", withdraw: "" });
    const pc = plain(base);
    pc[0].movements.push({ id: 5, type: "day", balance: 490, deposit: 0, withdraw: 0, date: "2026-10-05T20:00:00.000Z" });
    const merged = plain(app.mergeProjects(base, phone, pc));
    assert.equal(merged[0].movements.find(m => m.id === 2).balance, 530);
    assert.deepEqual(merged[0].movements.map(m => m.id), [1, 2, 3, 4, 5]);
});

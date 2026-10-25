const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-10-25T18:00:00");
const plain = v => JSON.parse(JSON.stringify(v));

test("calcolatrice: numeri, segni, virgola e somme in fila", () => {
    assert.equal(app.parseCalcExpression("5"), 5);
    assert.equal(app.parseCalcExpression("+5"), 5);
    assert.equal(app.parseCalcExpression("-3"), -3);
    assert.equal(app.parseCalcExpression("2,5"), 2.5);
    assert.equal(app.parseCalcExpression(" 5 + 2,5 - 3 "), 4.5);
    assert.equal(app.parseCalcExpression("0.1+0.2"), 0.3);
    assert.ok(isNaN(app.parseCalcExpression("")));
    assert.ok(isNaN(app.parseCalcExpression("abc")));
    assert.ok(isNaN(app.parseCalcExpression("5+")));
    assert.ok(isNaN(app.parseCalcExpression("5*2")));
});

const project = () => ({
    id: 1, name: "Test", capital: 1000, goal: 1000, status: "active",
    createdAt: "2026-10-01T08:00:00.000Z", endDate: "2027-10-01",
    movements: [
        { id: 1, type: "deposit", amount: 1000, date: "2026-10-01T08:00:00.000Z" },
        { id: 2, type: "day", balance: 1000, deposit: 0, withdraw: 0, date: "2026-10-24T20:00:00.000Z" },
        { id: 3, type: "day", balance: 1010, deposit: 0, withdraw: 0, date: "2026-10-25T10:00:00.000Z" }
    ]
});

test("anteprima: aggiungere una vincita al resoconto di oggi aggiorna G/P e stop senza salvare", () => {
    const p = project();
    const before = plain(p);
    const pv = app.previewMovementEdit(p, 3, { date: p.movements[2].date, balance: 1015, deposit: "", withdraw: "" });
    assert.equal(pv.error, "");
    assert.equal(pv.dayDiff, 15);
    assert.equal(pv.balanceAfter, 1015);
    assert.equal(pv.isToday, true);
    assert.equal(pv.todayPL, 15);
    assert.deepEqual(plain(p), before); // il progetto vero non cambia
});

test("anteprima: una perdita oltre lo stop giornaliero dice di fermarsi", () => {
    const p = project();
    // stop giornaliero di default 5% della banca a inizio giornata (1000 €) = 50 €
    const pv = app.previewMovementEdit(p, 3, { date: p.movements[2].date, balance: 940, deposit: "", withdraw: "" });
    assert.equal(pv.todayPL, -60);
    assert.ok(pv.dailyLeft <= 0);
    assert.ok(pv.stop.some(t => /Stop giornaliero/i.test(t)), plain(pv.stop).join());
    const ok = app.previewMovementEdit(p, 3, { date: p.movements[2].date, balance: 990, deposit: "", withdraw: "" });
    assert.equal(ok.stop.length, 0);
    assert.equal(ok.dailyLeft, 40);
});

test("anteprima: valori non validi restituiscono l'errore", () => {
    const p = project();
    assert.match(app.previewMovementEdit(p, 3, { date: p.movements[2].date, balance: "" }).error, /saldo valido/);
});

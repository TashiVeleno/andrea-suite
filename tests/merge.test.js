const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const app = loadApp("2026-10-16T12:00:00");
const plain = v => JSON.parse(JSON.stringify(v));
const merge = (base, local, remote) => plain(app.mergeProjects(base, local, remote));

const base = [
    { id: 1, name: "A", goal: 1000, movements: [{ id: 11, type: "deposit", amount: 500 }] },
    { id: 2, name: "B", goal: 2000, movements: [], bets: [] }
];
const copy = () => plain(base);

test("modifiche su progetti diversi: si tengono tutte e due", () => {
    const pc = copy();
    pc[0].movements.push({ id: 12, type: "withdraw", amount: 100 });   // prelievo dal PC sul progetto A
    const phone = copy();
    phone[1].bets.push({ id: 21, strategyId: "s1", pl: 5 });           // operazione dal telefono sul progetto B
    const result = merge(base, phone, pc);
    assert.deepEqual(result[0].movements.map(m => m.id), [11, 12]);
    assert.deepEqual(result[1].bets.map(b => b.id), [21]);
});

test("movimenti aggiunti sullo stesso progetto da due dispositivi: ci sono entrambi", () => {
    const pc = copy();
    pc[0].movements.push({ id: 12, type: "withdraw", amount: 100 });
    const phone = copy();
    phone[0].movements.push({ id: 13, type: "deposit", amount: 50 });
    assert.deepEqual(merge(base, phone, pc)[0].movements.map(m => m.id), [11, 13, 12]);
});

test("un dispositivo rimasto indietro non annulla le modifiche dell'altro", () => {
    const pc = copy();
    pc[0].name = "A rinominato";
    pc.push({ id: 3, name: "Nuovo", movements: [] });
    const phone = copy(); // non ha visto niente, salva senza cambiare nulla
    const result = merge(base, phone, pc);
    assert.equal(result[0].name, "A rinominato");
    assert.deepEqual(result.map(p => p.id), [1, 2, 3]);
});

test("stesso campo cambiato da tutte e due le parti: vince chi salva", () => {
    const pc = copy(); pc[0].goal = 1500;
    const phone = copy(); phone[0].goal = 1800; phone[0].name = "A2";
    const result = merge(base, phone, pc);
    assert.equal(result[0].goal, 1800);
    assert.equal(result[0].name, "A2");
});

test("le cancellazioni restano cancellazioni", () => {
    const pc = copy();
    pc[0].movements = [];                // movimento eliminato sul PC
    const phone = copy();
    phone.splice(1, 1);                  // progetto B eliminato sul telefono
    const result = merge(base, phone, pc);
    assert.deepEqual(result.map(p => p.id), [1]);
    assert.deepEqual(result[0].movements, []);
});

test("cancellato da una parte e modificato dall'altra: resta cancellato", () => {
    const pc = copy(); pc[1].name = "B modificato";
    const phone = copy(); phone.splice(1, 1);
    assert.deepEqual(merge(base, phone, pc).map(p => p.id), [1]);
});

test("senza base (primo avvio) non si perde niente", () => {
    const pc = [{ id: 1, name: "A", movements: [{ id: 11 }] }];
    const phone = [{ id: 2, name: "B", movements: [] }];
    assert.deepEqual(merge([], phone, pc).map(p => p.id), [2, 1]);
});

test("l'ordine delle chiavi del cloud non conta", () => {
    assert.ok(app.sameData({ a: 1, b: { c: 2, d: [1, 2] } }, { b: { d: [1, 2], c: 2 }, a: 1 }));
    const remote = [{ movements: [{ amount: 500, type: "deposit", id: 11 }], goal: 1000, name: "A", id: 1 }, base[1]];
    const phone = copy(); phone[0].name = "A2";
    assert.equal(merge(base, phone, remote)[0].name, "A2");
});

test("Bilancio Vita Reale: i totali dei progetti eliminati si sommano", () => {
    const b = { manualDeposits: 100, manualWithdrawals: 0, deletedDeposits: 50, deletedWithdrawals: 0 };
    const pc = { ...b, deletedDeposits: 80 };                       // eliminato un progetto da 30 sul PC
    const phone = { ...b, deletedDeposits: 70, manualDeposits: 120 }; // eliminato uno da 20 sul telefono
    assert.deepEqual({ ...app.mergeRealLife(b, phone, pc) },
        { manualDeposits: 120, manualWithdrawals: 0, deletedDeposits: 100, deletedWithdrawals: 0 });
    assert.deepEqual(app.mergeRealLife(b, null, pc), pc);
    assert.deepEqual(app.mergeRealLife(b, phone, null), phone);
});

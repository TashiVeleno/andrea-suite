const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const NOW = "2026-10-15T12:00:00"; // "oggi" per tutti i test
const app = loadApp(NOW);
const close = (actual, expected, eps = 1e-6) =>
    assert.ok(Math.abs(actual - expected) < eps, `atteso ${expected}, ottenuto ${actual}`);

// Progetto di esempio: 1000 € versati a gennaio, +500 a settembre, +200 a ottobre (con un prelievo di 100)
function sampleProject() {
    return {
        id: 1, name: "Esempio", capital: 1000, goal: 3650, endDate: "2026-12-31",
        status: "active", createdAt: "2026-01-01T00:00:00",
        movements: [
            { id: 11, type: "deposit", amount: 1000, date: "2026-01-01T09:00:00" },
            { id: 12, type: "day", balance: 1500, deposit: 0, withdraw: 0, date: "2026-09-30T20:00:00" },
            { id: 13, type: "day", balance: 1600, deposit: 0, withdraw: 100, date: "2026-10-10T20:00:00" }
        ]
    };
}

test("calculateProject: saldo, risultato, ritmo lineare", () => {
    const s = app.calculateProject(sampleProject());
    assert.equal(s.balance, 1600);
    assert.equal(s.deposits, 1000);
    assert.equal(s.withdrawals, 100);
    assert.equal(s.result, 700);                 // 1600 + 100 - 1000
    assert.equal(s.history[2].dayDiff, 200);     // (1600 - 1500) + 100 di prelievo
    assert.equal(s.profitThisMonth, 200);        // 700 ora - 500 a fine settembre
    assert.equal(s.totalDays, 365);
    assert.equal(s.elapsedDays, 288);            // 1 gen → 15 ott
    close(s.expectedToday, 3650 * 288 / 365);    // 2880
    assert.equal(s.daysRemaining, 78);           // 15 ott → 31 dic, estremi inclusi
    close(s.dailyNeeded, (3650 - 700) / 78);
    close(s.percentage, 70);                     // 700 / 1000
});

test("calculateProject: con più versamenti del capitale la % si calcola sul versato", () => {
    const p = sampleProject();
    p.movements.push({ id: 14, type: "deposit", amount: 1000, date: "2026-10-11T09:00:00" });
    const s = app.calculateProject(p);
    assert.equal(s.capitalBase, 2000);
    close(s.percentage, 700 / 2000 * 100);
});

test("tabella di marcia composta: tasso, rate giornaliere e mesi", () => {
    const stats = { balance: 1000, goalRemaining: 1000, daysRemaining: 100, result: 0 };
    const plan = app.calculateCompoundPlan({}, stats);
    const rate = Math.pow(2, 1 / 100) - 1;

    close(plan.rate, rate);
    assert.equal(plan.target, 2000);
    close(plan.todayDaily, 1000 * rate);
    close(plan.lastDaily, 1000 * Math.pow(1 + rate, 99) * rate);
    close(plan.monthlyRate, Math.pow(1 + rate, 30.44) - 1);

    // 100 giorni da oggi (15 ott) → fino al 22 gen: ott (17 gg), nov, dic, gen (22 gg)
    assert.deepEqual([...plan.months.map(m => m.days)], [17, 30, 31, 22]);
    assert.equal(plan.months.reduce((t, m) => t + m.days, 0), 100);
    close(plan.months.reduce((t, m) => t + m.monthGain, 0), 1000, 1e-6);
    close(plan.months.at(-1).equityEnd, 2000, 1e-6);
    close(plan.months.at(-1).resultEnd, 1000, 1e-6);
    close(plan.months[0].weekly, 1000 * (Math.pow(1 + rate, 7) - 1));
});

test("tabella di marcia composta: niente piano se manca qualcosa", () => {
    assert.equal(app.calculateCompoundPlan({}, { balance: 0, goalRemaining: 100, daysRemaining: 10, result: 0 }), null);
    assert.equal(app.calculateCompoundPlan({}, { balance: 100, goalRemaining: 0, daysRemaining: 10, result: 0 }), null);
    assert.equal(app.calculateCompoundPlan({}, { balance: 100, goalRemaining: 100, daysRemaining: 0, result: 0 }), null);
});

test("tabella di marcia composta sul progetto vero", () => {
    const s = app.calculateProject(sampleProject());
    const plan = app.calculateCompoundPlan(sampleProject(), s);
    close(plan.months.at(-1).resultEnd, 3650, 1e-6); // si arriva esatti all'obiettivo
    assert.equal(plan.months.length, 3);              // ott, nov, dic
});

test("cedola: percentuale dell'utile del mese", () => {
    const s = app.calculateProject(sampleProject());
    assert.deepEqual({ ...app.calculateCedola(s, 50) }, { state: "ok", base: 200, amount: 100, toRecover: 0 });
    close(app.calculateCedola(s, 30).amount, 60);
});

test("cedola: mai più del risultato totale", () => {
    const c = app.calculateCedola({ profitThisMonth: 300, result: 150 }, 50);
    assert.equal(c.base, 150);
    assert.equal(c.amount, 75);
});

test("cedola: bloccata in perdita, zero senza utile nel mese", () => {
    const blocked = app.calculateCedola({ profitThisMonth: 50, result: -120 }, 50);
    assert.equal(blocked.state, "blocked");
    assert.equal(blocked.amount, 0);
    assert.equal(blocked.toRecover, 120);

    const none = app.calculateCedola({ profitThisMonth: -20, result: 400 }, 50);
    assert.equal(none.state, "noprofit");
    assert.equal(none.amount, 0);
});

// ===== SOGLIE DEGLI ALLARMI =====
// Banca 1000 €, resoconto di ieri a 1000 e di oggi al saldo indicato
function dayProject(todayBalance, extra = {}) {
    return {
        id: 2, name: "Allarmi", capital: 1000, goal: 500, endDate: "2027-10-01",
        status: "active", createdAt: "2026-10-01T00:00:00",
        movements: [
            { id: 21, type: "deposit", amount: 1000, date: "2026-10-01T09:00:00" },
            { id: 22, type: "day", balance: 1000, deposit: 0, withdraw: 0, date: "2026-10-14T20:00:00" },
            { id: 23, type: "day", balance: todayBalance, deposit: 0, withdraw: 0, date: "2026-10-15T10:00:00" }
        ],
        ...extra
    };
}
const alarmsOf = p => app.calculateAlarms(p, app.calculateProject(p));
const titles = p => alarmsOf(p).map(a => `${a.level}: ${a.title}`);

test("stop giornaliero: rosso al 5% di perdita, giallo al 75% dello stop", () => {
    assert.ok(titles(dayProject(950)).includes("red: Stop giornaliero raggiunto"));          // -50 = 5% di 1000
    assert.ok(titles(dayProject(962.5)).includes("yellow: Vicino allo stop giornaliero"));   // -37,50 = 75% dello stop
    assert.ok(!titles(dayProject(963)).some(t => t.includes("stop giornaliero")));           // -37 = sotto il 75%
});

test("stop giornaliero: il limite si calcola sulla banca di inizio giornata", () => {
    const p = dayProject(950);
    const mm = app.calculateMoneyManagement(p, app.calculateProject(p));
    assert.equal(mm.todayPL, -50);
    assert.equal(mm.dailyLimit, 50);
    assert.equal(mm.dailyUsed, 1);
    assert.equal(mm.monthlyLimit, 150); // 15% della banca a inizio mese
});

test("stop disattivato con percentuale a zero", () => {
    const p = dayProject(900, { rules: { dailyStopPct: 0 } });
    assert.ok(!titles(p).some(t => t.includes("stop giornaliero")));
});

test("calo dal picco: dimezza le puntate al 20%, stop al 30%", () => {
    const withPeak = bottom => ({
        ...dayProject(bottom),
        movements: [
            { id: 31, type: "deposit", amount: 1000, date: "2026-10-01T09:00:00" },
            { id: 32, type: "day", balance: 2000, deposit: 0, withdraw: 0, date: "2026-10-12T20:00:00" },
            { id: 33, type: "day", balance: bottom, deposit: 0, withdraw: 0, date: "2026-10-13T20:00:00" },
            { id: 34, type: "day", balance: bottom, deposit: 0, withdraw: 0, date: "2026-10-14T20:00:00" }
        ]
    });

    const warn = withPeak(1600);
    const mm = app.calculateMoneyManagement(warn, app.calculateProject(warn));
    assert.equal(mm.peak, 2000);
    close(mm.drawdownPct, 20);
    assert.equal(mm.reduced, true);
    assert.equal(mm.stakePct, 1);   // 2% → 1%
    assert.equal(mm.layPct, 1.5);   // 3% → 1,5%
    assert.ok(titles(warn).includes("yellow: Calo dal picco: riduci le puntate"));

    assert.ok(titles(withPeak(1400)).includes("red: Calo dal picco troppo forte"));
    assert.ok(!titles(withPeak(1601)).some(t => t.includes("Calo dal picco")));
});

test("tilt: 3 giornate in perdita di fila e perdita oltre il 15% in un giorno", () => {
    const losing = dayProject(990);
    losing.movements.splice(1, 0,
        { id: 41, type: "day", balance: 1010, deposit: 0, withdraw: 0, date: "2026-10-12T20:00:00" },
        { id: 42, type: "day", balance: 1005, deposit: 0, withdraw: 0, date: "2026-10-13T20:00:00" });
    losing.movements[3].balance = 1000; // 14 ott: -5, 15 ott: -10 → tre giornate negative
    assert.ok(titles(losing).includes("yellow: 3 giornate in perdita di fila"));

    const p = dayProject(840, { rules: { dailyStopPct: 0, monthlyStopPct: 0 } }); // -16% in un giorno
    assert.ok(titles(p).includes("red: Perdita oltre il 15% in un giorno"));
    const q = dayProject(850, { rules: { dailyStopPct: 0, monthlyStopPct: 0 } }); // -15% esatto: niente
    assert.ok(!titles(q).includes("red: Perdita oltre il 15% in un giorno"));
});

test("scadenza superata e ritmo sul piano", () => {
    const late = { ...sampleProject(), endDate: "2026-10-01" };
    assert.ok(titles(late).includes("red: Scadenza superata"));

    // Dopo 9 mesi e mezzo con 700 € su 2880 previsti (sotto il 50%) → rosso
    assert.ok(titles(sampleProject()).includes("red: Molto indietro sul piano"));
});

test("resoconto mancante dopo 3 giorni", () => {
    const p = dayProject(1000);
    p.movements = p.movements.filter(m => m.type !== "day" || m.date < "2026-10-13");
    p.movements.push({ id: 51, type: "day", balance: 1000, deposit: 0, withdraw: 0, date: "2026-10-12T20:00:00" });
    assert.ok(titles(p).includes("yellow: Resoconto mancante"));
    p.movements.at(-1).date = "2026-10-13T20:00:00"; // 2 giorni fa
    assert.ok(!titles(p).includes("yellow: Resoconto mancante"));
});

test("strategia sotto soglia (rosso) o in dubbio (giallo)", () => {
    const withBets = wins => dayProject(1000, {
        strategies: [{ id: "s1", name: "Prova", side: "back", breakEven: 50 }],
        bets: Array.from({ length: 40 }, (_, i) => ({
            id: 100 + i, strategyId: "s1", pl: i < wins ? 1 : -1, stake: 0, date: "2026-10-05T15:00:00"
        }))
    });
    // 10 vinte su 40 con soglia 50%: z ≈ -3,16 → sotto soglia
    assert.ok(titles(withBets(10)).includes("red: Strategia sotto soglia: Prova"));
    // 19 su 40: z ≈ -0,32 → in dubbio
    assert.ok(titles(withBets(19)).includes("yellow: Strategia in dubbio: Prova"));
    // 22 su 40: sopra soglia → nessun allarme
    assert.ok(!titles(withBets(22)).some(t => t.includes("Prova")));
});

test("nessun allarme su progetti chiusi o senza deposito", () => {
    assert.equal(alarmsOf({ ...dayProject(500), status: "completed" }).length, 0);
    assert.equal(alarmsOf({ ...dayProject(500), movements: [] }).length, 0);
});

test("soglia di pareggio e quota minima, commissione inclusa", () => {
    close(app.breakEvenFromOdds("back", 2, 0), 50);
    close(app.breakEvenFromOdds("lay", 2, 0), 50);
    close(app.breakEvenFromOdds("back", 3, 4.5), 100 / (1 + 2 * 0.955));
    assert.equal(app.breakEvenFromOdds("back", 1, 4.5), null);

    // La quota limite è l'inversa della soglia di pareggio
    for (const side of ["back", "lay"]) {
        for (const q of [1.33, 2, 4.27, 5.96]) {
            close(app.oddsLimitFromWinRate(side, app.breakEvenFromOdds(side, q, 4.5), 4.5), q, 1e-9);
        }
    }
});

test("vincita netta e chiusura anticipata", () => {
    close(app.netWinFromOdds("back", 10, 3, 5), 19);       // 10 × 2 × 0,95
    close(app.netWinFromOdds("lay", 20, 3, 5), 9.5);        // responsabilità 20 a quota 3 → 10 × 0,95
    const t = app.tradeResult("back", 10, 3, 2, 0, 0);       // uscita in pari: banco 15 a quota 2
    close(t.amount, 15);
    close(t.ifWins, 5);
    close(t.ifLoses, 5);
    close(t.pl, 5);
});

/**
 * `npm run sim` — 밸런스 리포트.
 *
 * `docs/02-ECONOMY.md` "시뮬레이션에서 반드시 감시할 지표" 4개를 출력한다.
 * **판단은 사람이 한다.** 기준 미달을 눈에 띄게 찍되 수치를 임의로 고치지 않는다.
 *
 * 단언으로 굳혀야 하는 건 `tests/balance.test.ts` 쪽이다.
 */

import { BALL_TYPE_COUNT } from "../src/core/content/balls";
import { KEYCAP_COUNT } from "../src/core/content/keycaps";
import { unlockedTypeCount } from "../src/core/engine";
import { formatDuration, formatNumber, orderOfMagnitude } from "../src/core/numbers";
import type { GoldSource } from "../src/core/state";
import { deltaBySource, type SimResult, simulate } from "./simulate";

/** `docs/02-ECONOMY.md` §9 "목표 페이싱" */
const GOAL_FIRST_REBIRTH_S = 600;
const GOAL_ALL_TYPES_MIN_S = 8 * 3600;
const GOAL_ALL_TYPES_MAX_S = 10 * 3600;
const GOAL_GOLD_MAGNITUDE = 12;
/** 후반에 키캡 수입 비중이 이 밑으로 내려가면 화면 주인공이 무의미해진 것이다 */
const KEYCAP_SHARE_FLOOR = 0.01;

const OK = "  OK ";
const BAD = "  !! ";

function main(): void {
	const hours = Number(process.argv[2] ?? 20);
	const seed = Number(process.argv[3] ?? 1);
	console.log(`\n왁뿌볼 밸런스 리포트 — ${hours}시간 / seed ${seed}\n`);

	const r = simulate({ hours, seed });
	console.log(`시뮬 ${r.totalTicks.toLocaleString()} 틱을 ${r.elapsedMs}ms 에 돌렸다\n`);

	pacing(r);
	incomeMix(r);
	goldScale(r, hours);
	collection(r);

	console.log(
		"\n⚠️  이 수치는 전부 잠정값이다 (`docs/02-ECONOMY.md` 머리말).\n" +
			"    미달 항목을 보고 오너가 한 번에 확정한다. 임의로 고치지 말 것.\n",
	);
}

// ── 지표 1 · 첫 환생까지 시간 ────────────────────────────────────────────────

function pacing(r: SimResult): void {
	console.log("① 페이싱 — docs/02-ECONOMY.md §9");
	row("첫 왁뿌볼", r.firstBallAt, 20);
	row("첫 파괴", r.firstBreakAt, 20);
	row("첫 룰렛", r.firstRollAt, 60);
	row("첫 키캡", r.firstCapAt, 180);
	row("첫 Rare 키캡", r.firstRareCapAt, 180);
	row("★ 첫 환생", r.firstRebirthAt, GOAL_FIRST_REBIRTH_S);
	row("자동 키캡", r.autoKeycapAt, 3600);
	row("자동 파괴", r.autoBreakAt, 4 * 3600);
	console.log("");
}

function row(label: string, at: number | null, goalSeconds: number): void {
	if (at === null) {
		console.log(
			`${BAD}${label.padEnd(14)} 도달 못 함           (목표 ${formatDuration(goalSeconds)})`,
		);
		return;
	}
	const flag = at <= goalSeconds ? OK : BAD;
	console.log(
		`${flag}${label.padEnd(14)} ${formatDuration(at).padEnd(12)} (목표 ${formatDuration(goalSeconds)})`,
	);
}

// ── 지표 2 · 시간대별 골드 수입 출처 비율 ─────────────────────────────────────

function incomeMix(r: SimResult): void {
	console.log("② 골드 수입 출처 — 후반에 키캡이 0 으로 수렴하면 경고");
	console.log("      구간        키캡    왁뿌볼    방치    환급");
	let prev: (typeof r.samples)[number] | undefined;
	let lastKeycapShare = 1;
	for (const s of r.samples) {
		const delta = deltaBySource(prev, s);
		const total = sum(delta);
		if (total > 0) {
			const share = (k: GoldSource): number => delta[k].toNumber() / total;
			lastKeycapShare = share("keycap");
			console.log(
				`      ${formatDuration(s.t).padEnd(10)}` +
					`${pct(share("keycap"))}  ${pct(share("ball"))}  ${pct(share("idle"))}  ${pct(share("refund"))}`,
			);
		}
		prev = s;
	}
	console.log(
		lastKeycapShare < KEYCAP_SHARE_FLOOR
			? `${BAD}후반 키캡 비중 ${pct(lastKeycapShare)} — 화면 주인공이 무의미해졌다`
			: `${OK}후반 키캡 비중 ${pct(lastKeycapShare)}`,
	);
	console.log("");
}

function sum(d: Record<GoldSource, { toNumber(): number }>): number {
	return d.keycap.toNumber() + d.ball.toNumber() + d.idle.toNumber() + d.refund.toNumber();
}

function pct(v: number): string {
	return `${(v * 100).toFixed(1).padStart(5)}%`;
}

// ── 지표 3 · 20시간 시점 골드 자릿수 ─────────────────────────────────────────

function goldScale(r: SimResult, hours: number): void {
	console.log("③ 골드 규모 — 장르 기대치");
	const total = r.state.perm.stats.totalGold;
	const mag = orderOfMagnitude(total);
	const flag = mag >= GOAL_GOLD_MAGNITUDE ? OK : BAD;
	console.log(`      누적 골드    ${formatNumber(total)}  (1e${mag})`);
	console.log(`      보유 골드    ${formatNumber(r.state.run.gold)}`);
	console.log(`      환생재화     ${formatNumber(r.state.meta.rebirthCurrency)}`);
	console.log(`      환생 횟수    ${r.state.perm.stats.totalRebirths}`);
	console.log(`${flag}${hours}시간 시점 1e${mag} (최소 1e${GOAL_GOLD_MAGNITUDE})`);
	console.log("");
}

// ── 지표 4 · 50종 해금 완료 시점 ─────────────────────────────────────────────

function collection(r: SimResult): void {
	console.log("④ 수집 — 목표 8~10시간에 50종");
	const types = unlockedTypeCount(r.state);
	console.log(`      종류         ${types}/${BALL_TYPE_COUNT}`);
	console.log(`      키캡         ${r.state.meta.caps.length}/${KEYCAP_COUNT}`);
	console.log(`      누적 파괴    ${r.state.perm.stats.totalBreaks.toLocaleString()}`);
	if (r.allTypesAt === null) {
		console.log(`${BAD}50종 미완료 (목표 8~10시간)`);
	} else {
		const inRange = r.allTypesAt >= GOAL_ALL_TYPES_MIN_S && r.allTypesAt <= GOAL_ALL_TYPES_MAX_S;
		console.log(
			`${inRange ? OK : BAD}50종 완료 ${formatDuration(r.allTypesAt)} (목표 08:00:00~10:00:00)`,
		);
	}
	console.log(
		r.allCapsAt === null
			? `${BAD}키캡 24종 미완료 (목표 15~20시간)`
			: `${OK}키캡 24종 완료 ${formatDuration(r.allCapsAt)}`,
	);
}

main();

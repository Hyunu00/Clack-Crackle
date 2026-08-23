/**
 * 밸런스 리포트 CLI. `npm run sim` (tsx 로 실행)
 *
 * docs/02-ECONOMY.md "시뮬레이션에서 반드시 감시할 지표" 4개를 출력한다.
 * 아직 src/core/engine.ts 가 없으므로 지금은 목록만 찍는다.
 */

const METRICS = [
	["첫 환생까지 시간", "목표 10분"],
	["시간대별 골드 수입 출처 비율", "후반 키캡 비중이 0 에 수렴하면 경고"],
	["20시간 시점 골드 자릿수", "최소 1e12"],
	["50종 해금 완료 시점", "목표 8~10시간"],
] as const;

console.log("=== 밸런스 리포트 ===\n");
console.log("아직 엔진이 없다. src/core/engine.ts 가 생기면 여기서 20시간을 돌린다.");
console.log("(20시간 시뮬레이션 실측 91ms — docs/09-DEV-ENV.md)\n");

for (const [name, goal] of METRICS) {
	console.log(`  [ ] ${name}\n        ${goal}`);
}
console.log("");

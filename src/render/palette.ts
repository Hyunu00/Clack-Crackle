/**
 * docs/03-ART.md 의 팔레트.
 *
 * ★ index.html 의 CSS 변수와 항상 같이 고칠 것. 두 곳이다.
 */
export const PALETTE = {
	/** 케이스 (배경) */
	case: 0x14161c,
	/** 플레이트 */
	plate: 0x272d3a,
	/** 키캡 상단 (PBT 베이지) */
	cap: 0xe8e2d4,
	/** 골드 / 강조 */
	amber: 0xf2b705,
	/** 보조 */
	jade: 0x6ec3c1,
} as const;

export type PaletteKey = keyof typeof PALETTE;

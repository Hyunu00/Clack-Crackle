import { pixiPipes } from "@assetpack/core/pixi";

// assets/ 의 raw PNG 를 public/atlas/ 로 패킹한다 (docs/03-ART.md)
// 폴더 이름의 {tps} 태그가 붙은 폴더만 스프라이트시트로 묶인다. AssetPack 규칙이다.
export default {
	entry: "./assets",
	output: "./public/atlas",
	cache: true,
	pipes: [
		...pixiPipes({
			resolutions: { default: 1 },
			// 압축은 pixiPipes 기본값(png quality 90 / webp quality 80)을 그대로 쓴다.
			//
			// ★ 픽셀아트 시절엔 여기서 무손실을 강제했었다 — 손실 압축이 픽셀 격자를
			//   뭉갰기 때문이다. 캐주얼 아트는 그 제약이 없으니 기본값이 곧 정답이다.
			//   `compression` 필드를 아예 안 넘기면 pixiPipes 가 png/webp 둘 다 낸다.
			//
			// 아틀라스 .json 을 만드는 게 이 압축 파이프다. png 를 끄면 .json 도
			// 같이 사라지니 손대더라도 png 는 켜 둘 것.
			cacheBust: false,
			texturePacker: {
				texturePacker: {
					nameStyle: "short",
					padding: 2,
					allowRotation: false,
				},
			},
		}),
	],
};

import { pixiPipes } from "@assetpack/core/pixi";

// assets/ 의 raw PNG 를 public/atlas/ 로 패킹한다 (docs/03-ART.md)
// 폴더 이름의 {tps} 태그가 붙은 폴더만 스프라이트시트로 묶인다. AssetPack 규칙이다.
export default {
	entry: "./assets",
	output: "./public/atlas",
	cache: true,
	pipes: [
		...pixiPipes({
			// 픽셀아트다. 0.5x 밉맵을 만들면 안 된다
			resolutions: { default: 1 },
			// 무손실 PNG 만 낸다. webp/avif 로 변환하면 픽셀이 뭉개진다.
			//
			// 함정 두 개:
			//  ① `compression: false` 로는 안 꺼진다 — pixiPipes 가 기본값과
			//     recursive merge 를 해서 객체가 살아남는다. 포맷별로 꺼야 한다.
			//  ② 그렇다고 `png: false` 로 두면 아틀라스 .json 이 아예 안 나온다.
			//     ui.png.json 을 만드는 게 이 파이프다. png 는 켜 둘 것.
			//     palette:false 라 sharp 의 quality 가 안 먹고 무손실로 나간다.
			compression: {
				png: { palette: false, compressionLevel: 9 },
				jpg: false,
				webp: false,
				avif: false,
				bc7: false,
				astc: false,
				basis: false,
				etc: false,
			},
			// 파일명에 해시를 붙이지 않는다.
			// core/content/ 의 spriteKey 가 프레임 이름과 그대로 일치해야 한다
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

const SCRIPT_ID = "kakao-maps-sdk";
const APP_KEY   = import.meta.env.VITE_KAKAO_MAPS_API_KEY as string | undefined;

let _promise: Promise<void> | null = null;

export function loadKakaoSDK(): Promise<void> {
    // 이미 완전히 초기화된 경우
    if (window.kakao?.maps?.Map) return Promise.resolve();

    // 진행 중인 로드가 있으면 재사용
    if (_promise) return _promise;

    _promise = new Promise<void>((resolve, reject) => {
        if (!APP_KEY) {
            reject(new Error("VITE_KAKAO_MAPS_API_KEY가 설정되지 않았습니다."));
            return;
        }

        const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

        const doLoad = () => {
            if (window.kakao?.maps?.Map) { resolve(); return; }
            window.kakao.maps.load(resolve);
        };

        if (existing) {
            // 스크립트가 이미 DOM에 있는 경우 (OnboardingPage가 먼저 로드)
            if (window.kakao) { doLoad(); }
            else { existing.addEventListener("load", doLoad); }
            return;
        }

        const script = document.createElement("script");
        script.id    = SCRIPT_ID;
        script.src   = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${APP_KEY}&libraries=services&autoload=false`;
        script.onload  = doLoad;
        script.onerror = () => reject(new Error("Kakao Maps SDK 로드 실패"));
        document.head.appendChild(script);
    });

    return _promise;
}

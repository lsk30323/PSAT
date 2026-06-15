# PSAT 합격 패키지 — Android 앱

레포 루트의 PSAT 학습 마크다운 자료를 담는 [Capacitor](https://capacitorjs.com/)
기반 안드로이드 앱입니다. 웹앱(WebView) 래퍼 방식이며, 마크다운을 앱 내부에서
렌더링해 오프라인으로 열람할 수 있습니다.

```
app/
├─ www/                 # 웹앱 (HTML/CSS/JS + 벤더 marked.js)
│  ├─ index.html
│  ├─ app.js            # 목차 드로어 + 마크다운 뷰어
│  ├─ style.css
│  ├─ vendor/marked.min.js
│  └─ content/          # 빌드시 생성 (../ 의 .md 파일들 + index.json)
├─ build-content.mjs    # 레포의 .md → www/content 번들링
├─ capacitor.config.json
└─ android/             # Capacitor Android 네이티브 프로젝트
```

## 사전 요구사항

- Node.js 18+ (개발은 22로 검증)
- JDK 21
- Android SDK (Platform 34, Build-Tools) — `ANDROID_HOME` 설정 필요

> ⚠️ 이 레포가 클론된 Claude Code 원격 환경은 네트워크 정책상
> `dl.google.com` / `maven.google.com` 이 차단되어 **컨테이너 내부에서는
> Android SDK 설치 및 AAB 빌드가 불가능**합니다. 따라서 AAB는 아래
> **GitHub Actions** 또는 **로컬 머신**에서 빌드합니다.

## 로컬 빌드

```bash
cd app
npm install
npm run build          # 마크다운을 www/content 로 번들
npx cap sync android   # 웹 자산을 android 프로젝트로 복사

cd android
./gradlew bundleRelease # 결과: app/build/outputs/bundle/release/app-release.aab
```

### 릴리스 서명

서명은 환경변수로 키스토어를 주입할 때만 적용됩니다(키스토어는 커밋 금지).

```bash
# 키스토어 최초 1회 생성
keytool -genkey -v -keystore release.keystore -alias psat \
  -keyalg RSA -keysize 2048 -validity 10000

export ANDROID_KEYSTORE_FILE=/절대경로/release.keystore
export ANDROID_KEYSTORE_PASSWORD=...
export ANDROID_KEY_ALIAS=psat
export ANDROID_KEY_PASSWORD=...
./gradlew bundleRelease
```

## GitHub Actions 로 AAB 빌드 (권장)

`.github/workflows/android-release.yml` 가 GitHub 러너(Android SDK 내장,
네트워크 제약 없음)에서 AAB를 빌드해 Artifact로 업로드합니다.

1. 리포지토리 **Settings → Secrets and variables → Actions** 에 등록:
   - `ANDROID_KEYSTORE_BASE64` — `base64 -w0 release.keystore` 결과
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
2. 실행 방법: Actions 탭에서 수동 실행(`workflow_dispatch`) 또는
   `v1.0.0` 같은 `v*` 태그 푸시.
3. 완료 후 워크플로 실행 페이지에서 `psat-release-aab` 아티팩트 다운로드.

## Google Play 등록 절차 (수동)

자동화로 대체 불가한 단계로, 본인 계정으로 진행해야 합니다.

1. [Google Play Console](https://play.google.com/console) 개발자 등록(1회, $25).
2. 앱 생성 → 패키지명 `kr.co.vaultlife.psatpack`.
3. 스토어 등록정보 작성: 앱 이름·설명, 아이콘(512px), 피처 그래픽,
   스크린샷, **개인정보처리방침 URL**, 콘텐츠 등급 설문, 데이터 보안 양식.
4. 프로덕션(또는 내부 테스트) 트랙에 위에서 받은 `app-release.aab` 업로드.
5. 검토 제출 → 구글 심사(보통 수 시간~수일) 후 게시.

> 버전 갱신 시 `app/android/app/build.gradle` 의 `versionCode`(정수 증가)와
> `versionName` 을 올린 뒤 다시 빌드하세요.

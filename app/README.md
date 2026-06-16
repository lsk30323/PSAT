# PSAT 합격 패키지 — Android 앱

레포 루트의 PSAT 학습 마크다운 자료를 담는 [Capacitor](https://capacitorjs.com/)
기반 안드로이드 앱입니다. 웹앱(WebView) 래퍼 방식이며, 마크다운을 앱 내부에서
렌더링해 오프라인으로 열람할 수 있습니다.

```
app/
├─ www/                 # 웹앱 (HTML/CSS/JS + 벤더 marked.js)
│  ├─ index.html        # 학습자료 뷰어 (목차 드로어 + 마크다운)
│  ├─ app.js / style.css
│  ├─ quiz.html         # 문제풀이(퀴즈) 화면
│  ├─ quiz.js / quiz.css
│  ├─ vendor/marked.min.js
│  └─ content/          # 빌드시 생성 (.md 번들 + index.json + questions.json)
├─ build-content.mjs    # 레포의 .md → www/content 번들링
├─ build-questions.mjs  # 문제 마크다운 → www/content/questions.json 임포터
├─ data/
│  └─ original-questions.json  # 손으로 작성한 오리지널 문항 (편집·추가용)
├─ capacitor.config.json
└─ android/             # Capacitor Android 네이티브 프로젝트
```

## 문제풀이(퀴즈) 기능

`quiz.html` 은 `content/questions.json` 을 읽어 과목·유형별로 문제를 풀게 합니다.
- 과목/유형/문항 수 선택, 순서 섞기, 즉시채점 옵션
- 채점 결과 + 틀린 문제 해설 + **오답노트**(localStorage에 저장, 본인 기기 안에만)

### 문제 은행은 어떻게 채워지나

`npm run build:questions` 가 아래 **레포 자체 제작(학습용 재구성) 콘텐츠**를
파싱해 `questions.json` 을 만듭니다. 외부 기출 원문을 가져오지 않습니다.
- `모의고사/` → 모의고사 문항(정답·해설 포함)
- `문제집/유형별/*.md` → 유형별 문항
- `app/data/original-questions.json` → 손으로 작성한 오리지널 문항

답이 매칭되지 않거나 보기가 4개 미만(예: 표↔그래프 변환처럼 보기가 그림인 문항)인
경우는 자동으로 제외되어, 앱에는 **풀 수 있는 문항만** 들어갑니다.

### 문항 추가하기 (두 가지 방법)

1. **오리지널 직접 작성** — `app/data/original-questions.json` 의 `questions`
   배열에 객체를 추가하고 `npm run build` 후 `npx cap sync android`.
   ```json
   {
     "subject": "언어논리",          // 언어논리 | 자료해석 | 상황판단
     "type": "추론",
     "body": "지문/발문 (마크다운)",
     "choices": ["선지1", "선지2", "선지3", "선지4", "선지5"],
     "answer": 3,                      // 1-based 정답 번호
     "explanation": "해설(선택)"
   }
   ```
2. **본인이 합법적으로 확보한 기출을 마크다운으로 정리** — `모의고사/`·`문제집/유형별/`
   형식(`**N.**` 또는 `### 문제 N.` + ①–⑤ 선지, 별도 정답/해설)에 맞춰 .md를 추가하면
   임포터가 자동으로 읽습니다. (공식 기출 PDF는 사이버국가고시센터·국회 채용 사이트에서
   본인이 직접 내려받아 정리하세요. 제3자 저작 지문의 무단 대량 복제는 피하세요.)

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
./gradlew assembleDebug  # 개인용: app/build/outputs/apk/debug/app-debug.apk (서명 불필요)
./gradlew bundleRelease   # 스토어용: app/build/outputs/bundle/release/app-release.aab
```

> **나만 쓰기(개인용)** 가 목적이면 `assembleDebug` 로 만든 **APK를 본인 폰에
> 직접 설치(사이드로드)** 하는 게 가장 간단합니다. 키스토어·Play 등록이 필요 없습니다.
> CI에서도 `psat-debug-apk` 아티팩트로 받아 설치할 수 있습니다.

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

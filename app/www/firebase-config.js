// Firebase 설정값 — Firebase Console → 프로젝트 설정 → 내 앱(웹앱)에서 복사해 채우세요.
// 값이 "YOUR_..." 로 남아 있으면 구글/이메일 로그인은 비활성화되고 게스트만 동작합니다.
//
// 설정 방법:
//  1) https://console.firebase.google.com 에서 프로젝트 생성
//  2) Authentication → 시작하기 → '이메일/비밀번호'와 'Google' 공급자 사용 설정
//  3) 프로젝트 설정 → 내 앱 → 웹앱 추가 → 아래 firebaseConfig 값 복사
//  4) (안드로이드 구글 로그인) 앱 서명 SHA-1 지문을 Firebase에 등록하고
//     google-services.json 을 app/android/app/ 에 배치
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_APP_ID",
};

---
title: "FC Online 매일 이벤트 수령을 완전 자동화한 이야기"
summary: "매일 아침 7:30, 라즈베리파이가 데탑을 깨우고 FC Online에 자동 로그인 → 감독모드 20판 → 4시간 뒤 웹이벤트 수령 → 절전. 파이·데탑·텔레그램·Claude Code(SendInput + Claude in Chrome) 조합으로 만든 3티어 자동화."
date: "Apr 13 2026"
draft: false
tags:
- Home Automation
- Raspberry Pi
- Claude Code
---

## 하기 싫은데 매일 해야 되는 일

FC Online의 출석/감독모드/웹이벤트 같은 일일 보상은 **하루만 놓쳐도 아깝다**. 그렇다고 매일 데탑 켜서 로그인하고 감독모드 20판 돌리고 4시간 뒤 이벤트 페이지 들어가서 버튼 누르는 건 너무 귀찮다.

그래서 이걸 다 자동화했다. 지금은 내가 자는 동안 알아서 굴러가고, 폰으로는 텔레그램 알림만 보면 된다.

## 실제로 오는 텔레그램 알림 (오늘 아침 예시)

```
07:30  ⏰ 오전 7시 - FC Online 자동 시작
07:30  🔌 PC 절전 중. WoL 전송...
07:30  ✅ PC 켜짐! (15초 소요)
       리스너 준비 대기 중...
07:30  ✅ FC Online 미션 시작됨!
07:30  🎮 FC Online 미션 시작!
07:31  ✅ Part A 완료! 2차 로그인 화면 도달
07:32  ✅ Part B 완료! 로그인 성공
07:33  ✅ Part C 완료! 감독모드 진입
07:33  🏆 미션 완료! 감독모드 경기 시작됨
07:33  감독모드 시작 완료! 웹 이벤트 수령 대기중..
       (4시간 대기)
11:33  📸 4시간 경과. 게임 종료 전 스크린샷 (11:33)  [📷 이미지 첨부]
11:34  ✅ 감독모드 20판 종료 로그 생성 완료! (11:34)
       웹 이벤트 수령 대기중..
11:40  ✅ eventTaker가 오늘 피파 참여형 웹 이벤트 수령 완료!

       STATUS: SUCCESS
       TIMESTAMP: 2026-04-14 11:40:12
       MESSAGE: 이벤트 수령 완료
       --- 상세 결과 ---
       1. 출석+플레이: 조회하기 OK / 한번에 받기 OK / 마일스톤 보상 3개 수령
       2. 플레이 업그레이드: 조회하기 OK
       3. 주말에 접속 바람: SKIP (평일)
       4. 부여성의 선물: SKIP (기간 외)
       5. 25 UCL 예측: 조회하기 OK / 보상 2개 수령
       6. 콜라보 FC: 조회하기 OK / 보상 1개 수령
       7. 훈련코치 DIY: 조회하기 OK
       8. 아이콘 로드: 조회하기 OK
11:40  🌙 모든 작업 완료. PC 절전 중..
```

중간에 뭔가 꼬이면 이런 알림도 온다:

```
⚠️ Part A 실패. 처음부터 재시도..
❌ Part B 실패 (3회). 미션 중단.
🚨 오류 3회 감지! 계정 보호를 위해 미션 중단.
⚠️ eventTaker 완료 로그가 3시간 안에 생성되지 않았음
❌ PC가 120초 안에 켜지지 않음. 자동 시작 실패.
```

한 채팅방에 몰리니까 **그날 어디서 틀어졌는지가 한눈에 보인다**.

## 전체 구조 (3-tier)

```
┌──────────────────────────────────────────────┐
│  [1] cron @ Raspberry Pi 5                   │
│      매일 07:30 auto_start_fconline.py       │
└────────────────┬─────────────────────────────┘
                 │ Wake-on-LAN (매직 패킷)
                 │ + SSH 폴링으로 부팅 대기
                 │ + TCP trigger.py → 9999
                 ▼
┌──────────────────────────────────────────────┐
│  [2] GUI 세션 리스너 @ Windows Desktop       │
│      listener.py (TCP :9999) 상시 대기       │
│      명령별로 자동화 스크립트 기동             │
└────────────────┬─────────────────────────────┘
                 │ subprocess → GUI 세션에서 실행
                 ▼
┌──────────────────────────────────────────────┐
│  [3a] start_fconline.py                      │
│      Win32 SendInput (pyautogui 대체)        │
│      + claude -p (Sonnet/Opus) 비전 판정      │
│      Part A/B/C, 각 단계 텔레그램 직접 전송     │
│                                              │
│  [3b] gamdokmode_watcher.py                  │
│      4시간 대기 → 게임 종료 → 스크린샷 전송    │
│      → eventTaker 트리거 → 결과 폴링 → 절전     │
│                                              │
│  [3c] start_eventTaker.py                    │
│      claude -p --chrome (Claude in Chrome)   │
│      사용자 Chrome 세션에 붙어 8개 탭 순회       │
└──────────────────────────────────────────────┘
```

각 티어가 해결하는 문제가 서로 다르다. 그냥 SSH로 스크립트 하나 돌리면 될 것 같지만 **그렇게 못 한다**. 이유는 아래에 정리했다.

---

## 벽 하나: SSH에서는 GUI 입력이 먹히지 않는다

처음엔 단순하게 생각했다. 파이가 크론으로 데탑에 SSH 붙어서 파이썬 하나 실행 → 끝.

```bash
sshpass -p <pw> ssh <win-user>@<desktop-internal-ip> \
  'python C:\projects\fconline_auto_event\start_fconline.py'
```

그런데 **마우스 클릭이 Chrome에 도달하지 않았다**. 파고 보니:

- `pyautogui`/`SendInput`은 **현재 활성 GUI 세션(로그인된 바탕화면)의 input queue**에 이벤트를 주입한다
- SSH 세션은 별도 "session 0" 계열 비-대화 세션 → GUI와 분리돼 있음
- 즉 SSH에서 직접 SendInput → **어디에도 도달 못 함**

### 해결: GUI 세션 안의 상시 리스너 (`listener.py`)

Windows 로그인 직후 **TCP 리스너**를 GUI 세션 안에서 띄워둔다. 외부에서 "실행해" TCP 패킷만 보내면, 리스너가 **자기 세션 컨텍스트**에서 `subprocess.Popen`으로 자동화 스크립트를 돌린다 → SendInput 정상 작동.

리스너가 받는 명령어:

```
START_FCONLINE        풀 체인 (게임 실행 → 감독모드 → 4h → 웹이벤트 → 절전)
START_FCONLINE_TEST   테스트 버전
START_GAMDOK          감독모드 시작까지만 (watcher 생략)
START_EVENTTAKER      웹 이벤트 수령만 (Claude in Chrome)
SCREENSHOT            현 화면 캡처
STATUS                미션 진행 여부 조회
```

파이가 원격에서 보낼 땐 `trigger.py` 한 줄 헬퍼로:

```python
s = socket.create_connection(('localhost', 9999), timeout=5)
s.sendall((sys.argv[1] + '\n').encode())
print(s.recv(1024).decode())
```

응답 코드는 정해둠: `OK` / `ALREADY_RUNNING` / `LISTENER_NOT_RUNNING`. 파이 쪽이 이걸 보고 텔레그램 문구를 분기.

---

## 벽 둘: "Claude가 CDP로 접속하면 넥슨이 막는다"

이벤트 수령만 놓고 보면 원래 계획은 **Chrome DevTools Protocol(CDP)** 이었다. Chrome을 `--remote-debugging-port=9222`로 띄워두고, Claude가 CDP로 붙어 DOM 조작 → 이론상 제일 깔끔.

그런데 실제로 해보니 두 가지가 막혔다.

### (1) 세션 공유가 안 됨
- 내가 평소에 Chrome을 쓰는 사용자 프로필(로그인된 세션, 쿠키, 로컬스토리지)을
- CDP로 붙는 Claude Chrome 인스턴스가 **같이 쓰지 못함**
- 별도 프로필로 띄우면 넥슨 로그인이 처음부터 필요. 2차 비밀번호 단계도 다시.

### (2) 넥슨의 Turnstile류 캡차가 자동화 Chrome을 튕김
- CDP로 조종되는 Chrome은 `navigator.webdriver` 흔적이나 실행 플래그 차이로 감지됨
- FC Online 로그인/이벤트 페이지에서 주기적으로 **캡차가 뜨고 세션이 튕김**
- 일반 Chrome에서는 통과, CDP Chrome에서는 막힘

### 결국 길을 **둘로 갈랐다**

| 단계 | 도구 | 이유 |
| --- | --- | --- |
| 게임 실행·로그인·감독모드 진입 | **GUI 자동화 + 하드코딩 좌표** (`SendInput`) | 캡차가 사람처럼 보이는 마우스·키보드 이벤트에는 관대하다. Chrome에게 자기가 조종당하는 줄 모르게 함 |
| 웹 이벤트 수령 | **Claude in Chrome 확장** (`claude -p --chrome`) | 사용자 본인의 Chrome 세션에 확장으로 **올라타기** 때문에 CDP 탐지·세션 공유 문제를 동시에 우회 |

전자는 "사람 흉내", 후자는 "사람과 함께 앉기". 구현 철학이 반대다.

---

## [3a] start_fconline.py — SendInput + Claude vision

이게 가장 복잡하다. 전체 흐름:

| 단계 | 동작 | 의사결정 방식 |
| --- | --- | --- |
| 1 | `Win+S` → "chrome" → Enter | 고정 |
| 2 | 주소창에 "fc" → Enter (자동완성으로 fconline.nexon.com) | 고정 |
| 2.5 | 이미 최대화면 복원 후 재최대화 | `IsZoomed()` 체크 |
| 3 | 게임시작 버튼 클릭 | **Claude vision** (영역 크롭 → 좌표 추출) |
| 4 | 팝업 처리 (←, Enter), 30초 대기 | 고정 |
| 5 | 로딩 클릭 (1750, 550) × 15회, 3초 간격 | 고정 |
| 6 | Alt+Enter → Win+↑ (전체화면 해제 → 창모드 최대화) | 고정 |
| **Part A 성공 판정** | 현재 스크린샷 vs `part_a_success.png` | **Claude 4분할 비교** (Opus) |
| 7 | 키패드 영역 크롭 → 숫자 배치 인식 | **Claude vision** |
| 8 | 2차 비밀번호 4자리 입력 (자리당 1.5초) | 고정 좌표 + 인식된 숫자 매핑 |
| 8.9 | 오류 횟수 확인 (≥3이면 즉시 중단) | **Claude vision** (안전장치) |
| 9 | 게임 입장 (1209, 778), 20초 대기 | 고정 |
| 9.5 | 통과 확인. 실패면 7부터 재시도 (최대 3회) | **Claude 4분할 비교** |
| 10~13 | 게임 로비 → 감독모드 진입까지 4번 클릭 | 고정 좌표 |
| **Part C 성공 판정** | 스크린샷 vs `part_c_success.png` | **Claude 4분할 비교** |
| 14 | 감독모드 경기 시작 (1344, 987) | 고정 |

"고정"과 "Claude vision"이 섞여 있다. **바뀌지 않는 건 좌표로 때리고, 바뀌는 건 Claude에게 맡긴다**는 원칙.

### 왜 pyautogui가 아니라 SendInput인가

`pyautogui`는 WinAPI `mouse_event`/`keybd_event`를 쓰는데, 이건 더 오래된 API라 **일부 게임/보안 모듈이 무시**한다. FC Online은 안 먹혔다. 그래서 `input_handler.py`에서 ctypes로 `user32.SendInput`를 직접 감싸 썼다:

```python
# input_handler.py (요약)
class INPUT(Structure):  # Windows INPUT 구조체
    ...
def mouse_click(x, y):
    # 절대좌표 정규화 → SendInput 마우스 이벤트
def keyboard_type(text):
    # 유니코드 문자별 SendInput (KEYEVENTF_UNICODE)
def keyboard_key(vk):
    # VK 코드 직접 주입
```

`SendInput`은 유저 모드에서 가장 "OS가 생성한 것과 구분 안 되는" 입력 API다. 이거 바꿨더니 Chrome이 순순히 먹더라.

### 키패드 인식 — Claude에 그림을 좀 보여준다

2차 비밀번호는 **마우스 전용 숫자 키패드**고 매번 배치가 랜덤이다. 좌표만 하드코딩하면 못 푼다.

```python
# 흐름
NUMPAD_CROP = (922, 512, 1302, 662)     # 키패드 영역
NUMPAD_COLS = [960, 1036, 1112, 1188, 1264]  # 열별 중심 x (고정)
NUMPAD_ROWS = [550, 625]                 # 행별 중심 y (고정)
```

1. 전체 스크린샷 → 위 영역만 크롭
2. `claude -p --model claude-opus-4 "윗줄부터 JSON으로"` 에 이미지 전달
3. 응답을 파싱하여 `{'0': (x, y), ..., '9': (x, y)}` 매핑 생성
4. 좌표는 **항상 고정값**. Claude는 오로지 "순서"만 알려주면 됨

```json
{"row1": [7, 2, 9, 0, 4], "row2": [1, 8, 3, 5, 6]}
```

### Part 성공 판정 — 4분할 비교

Part A/B/C가 끝날 때마다 "기대하는 화면 맞냐"를 판정해야 한다. 여기서 쓴 기법:

- 현재 스크린샷을 4분할 (좌상/우상/좌하/우하)
- 레퍼런스 이미지도 4분할
- 각 사분면 쌍을 따로 Opus에 보내서 "같은 상태인가?" 질문
- **4개 중 3개 이상 yes면 성공**으로 간주

단일 이미지 통짜로 보여주는 것보다 분할해서 물어보면 거짓 양성이 줄었다. "UI 전체가 거의 같지만 미묘하게 다른 단계" 같은 케이스가 분할에서 더 잘 잡힌다.

### 안전장치 — 계정 잠금 방어

FC Online은 2차 비밀번호 **5회 틀리면 계정 잠김**. 자동화가 폭주해서 계정 날리는 시나리오가 최악이다. 그래서 8.9단계에서:

- 화면 하단 안내 영역 크롭
- Opus에 "여기에 오류 횟수 써 있으면 숫자로만" 질문
- 3회 이상이면 **즉시 스크립트 종료** (`return`)

실제로 두 번 구해줬다. 한 번은 Chrome 업데이트로 레이아웃 미세 이동, 두 번째는 전날 내가 수동 로그인 실패했던 것이 이어짐. 세 번 만에 멈췄다.

### 텔레그램 알림 — 이벤트 필터

`log()` 함수 안에서 마일스톤 문자열을 감지해 텔레그램으로 내보낸다.

```python
def _tg_notify_if_milestone(msg):
    if 'FC Online' in msg and '미션' in msg:
        notify_telegram('🎮 FC Online 미션 시작!')
    elif 'Part A' in msg and '성공' in msg:
        notify_telegram('✅ Part A 완료! 2차 로그인 화면 도달')
    ...
```

**모든 step 로그가 아니라 의미 있는 체크포인트만**. 안 그러면 폰이 진동만 울린다.

---

## [3b] gamdokmode_watcher.py — 4시간 타이머 + 뒷정리

`start_fconline.py`가 감독모드 시작 버튼까지만 누르면, `start_fconline.py` 끝에서 `Popen`으로 watcher를 띄운다. watcher 하는 일:

```python
def main():
    write_gamdok_start_log()           # 시작 시각 기록
    time.sleep(WAIT_HOURS * 3600)      # 4시간 대기

    # 카톡 프로세스 종료 (스크린샷에 카톡 팝업 끼는 거 방지)
    taskkill('KakaoTalk.exe')
    notify_photo('📸 4시간 경과. 게임 종료 전 스크린샷 ...')  # 텔레그램

    # 게임 프로세스 강제 종료
    kill_game()  # fczf.exe, FO4Launcher.exe, fifaonline4_kamuse.exe

    # 공유 폴더에 완료 로그 파일 생성
    write_gamdok_log(timestamp, verified=True)
    notify('✅ 감독모드 20판 종료 로그 생성 완료! ...')

    # eventTaker를 리스너 통해 트리거 (같은 세션 보존)
    trigger_eventtaker()  # → TCP 9999에 START_EVENTTAKER

    # eventTaker 완료 로그 폴링 (최대 3시간, 2분 간격)
    while time.time() - start < 10800:
        if os.path.exists(eventtaker_log) and mtime > trigger_time:
            break
        time.sleep(120)

    # 결과 텔레그램 전송
    notify(success_or_fail_header + log_body)

    if success:
        sleep_pc()  # rundll32.exe powrprof.dll,SetSuspendState...
```

**핵심 아이디어**: 감독모드가 돌아가는 4시간 내내 CPU 빨지 않고 `sleep`으로 잠들기. 완료 여부는 공유 폴더의 **파일 시그널** 하나로 판단.

---

## [3c] start_eventTaker.py + eventtaker_prompt.md — Claude in Chrome

이게 가장 실험적이었다. `claude -p --chrome`은 Claude Code의 **Chrome 확장(Claude in Chrome) 모드**:

- 내가 평소 쓰는 Chrome에 확장이 붙음
- 그 확장이 `claude-in-chrome` MCP 서버가 되어 Claude 세션에 노출됨
- Claude는 "내 사용자 Chrome"에 대고 navigate/click/snapshot 같은 툴을 호출함
- **쿠키·로그인 세션은 평소의 내 세션 그대로** — 넥슨 입장에선 "사용자 본인"이 도는 걸로 보임

실행은 단순하다:

```python
# start_eventTaker.py (요약)
cmd = [
    CLAUDE_BIN, '-p',
    '--chrome',
    '--dangerously-skip-permissions',
    '--model', 'claude-opus-4-20250514',
    header + open('eventtaker_prompt.md').read(),
]
subprocess.run(cmd, timeout=20*60, ...)
```

진짜 일은 **프롬프트가 한다**. `eventtaker_prompt.md`가 3~400줄짜리 명세서:

### 프롬프트 골격
- **절대 규칙 10개**: "이미 완료됨"·"내일 다시 할래요" 같은 임의 판단 금지, 무조건 진행·덮어쓰기, KST 시간 계산은 PowerShell만, Chrome 확장 미연결이면 `STATUS: FAIL` 정확히 이 포맷으로 기록
- **STEP 1**: 환경 확인 (KST 날짜 캡처, 공유 폴더 존재, 확장 연결)
- **STEP 2**: 8개 탭 순회. 각 탭마다 URL·버튼 찾는 규칙·주/월/기간 제한·스킵 조건 명시
  - ex) "주말에 접속 바람" 탭 = `DAYOFWEEK in {Saturday, Sunday}` 일 때만
  - ex) "부여성의 선물" = `20260416 ≤ YYYYMMDD ≤ 20260422` 범위일 때만
- **STEP 3**: `eventtaker_done_{YYYYMMDD}.log` 덮어쓰기 (STATUS: SUCCESS/FAIL, 탭별 상세)

### 프롬프트 설계에서 배운 것

이걸 에이전트에게 맡기려면 **"자기 판단으로 빠져나갈 구멍을 전부 막아야 한다"**. 초기 실행에선 Claude가 종종 이렇게 굴었다:

- 오늘 로그가 이미 있네? → "이미 완료됐으니 스킵하겠습니다" 하고 종료 ❌
- 버튼이 안 보이네? → "오늘은 보상이 없는 모양입니다" 하고 넘어감 ❌
- 날짜 애매하네? → 멋대로 추정해서 주말 이벤트를 평일에 처리 ❌

그래서 프롬프트 맨 위에 **"⚠️ 절대 규칙 — 먼저 읽으세요"** 블록을 두고,
*"이런 판단은 전부 금지", "기존 로그 내용 읽지 말 것", "읽는 것 자체가 금지", "합리화 금지, 실패는 실패라고 적어라"* 식으로 **닫힌 명령**으로 썼다. 그리고 나서야 안정적으로 돌기 시작했다.

### 실제 하는 일 요약

각 탭에 대해:
1. URL 방문
2. 조회하기/수령 버튼 찾기 (1차 텍스트, 2차 class, 3차 JS 평가)
3. 비활성(`disabled`, `aria-disabled="true"`) 버튼은 반드시 스킵
4. 여러 개 활성 보상이 있으면 **전부** 수령
5. 결과를 "OK / SKIP (사유) / FAIL (사유)" 중 하나로 상세 결과에 기록

마지막으로 `eventtaker_done_YYYYMMDD.log` 파일 쓰고 종료. watcher가 이걸 폴링으로 감지해서 텔레그램에 상세 결과를 쏜다. 끝.

### 완전 자율은 아니다 — 이벤트 업데이트마다 **자연어로 방향만 조금씩** 잡아준다

이 자동화는 "한번 만들면 영원히 돌아가는" 종류가 아니다. 넥슨이 이벤트를 바꿀 때마다 (거의 2~4주 간격):

- 새 URL이 생기거나 (`events.fconline.nexon.com/XXXXXX/...`)
- 수령 버튼의 문구/클래스/위치가 바뀌거나
- 기간 한정 이벤트 날짜 범위가 달라지거나
- 주말 한정 같은 조건이 새로 붙거나

→ 이런 변경이 있을 때마다 `eventtaker_prompt.md` 를 열어 **자연어로** 몇 줄 손본다.

> *"이번 주부터 '부여성의 선물' 4/16~4/22 기간은 끝났고, 대신 '왈숙네의 선물' 2주차가 4/18 주말부터 추가됐어. URL은 `https://events.fconline.nexon.com/260409/Special2` 로 바뀌었고 버튼은 활성화되면 전부 누르면 돼."*

이 정도 한 단락만 넣어도 Opus가 알아서 STEP 2의 해당 섹션을 찾아 고쳐준다. **코드 수정이 아니라 명세서 수정**. 이게 `claude -p --chrome` 에이전트 자동화의 가장 큰 매력이다.

**그래서 "완전 자동"이 아니라 "자연어로 유지보수되는 자동"**. 내 개입은 일주일에 2~3분 정도로 충분하다.

---

## 왜 이렇게 쪼갰나 — 책임 분리

- **listener.py**: "외부 신호를 GUI 세션으로 릴레이하는 스위치보드". 자기는 일 안 함
- **start_fconline.py**: "브라우저와 게임을 조종하는 파일럿". 손발만 움직임
- **gamdokmode_watcher.py**: "4시간 타이머 + 결과 집계자". 대기와 파일 I/O만
- **start_eventTaker.py**: "Claude in Chrome에게 프롬프트 던지는 얇은 래퍼"
- **eventtaker_prompt.md**: **진짜 알고리즘**이 여기 있음. 텍스트 명세서가 곧 코드

덕분에 한 곳이 깨져도 다른 곳이 계속 돈다:
- watcher가 죽어도 다음날 cron이 새로 시작
- eventTaker가 실패해도 watcher가 FAIL 로그로 알림
- listener가 죽었으면 Pi가 `LISTENER_NOT_RUNNING` 받고 "데탑에서 직접 확인 필요" 알림

---

## 파이 쪽 크론 스케줄 (참고)

```cron
# 07:30 FC Online 풀 체인 트리거
30 7 * * * .../venv/bin/python .../auto_start_fconline.py

# 12:30 감독 수령 리마인드 (자동화 실패시 백업 알림)
30 12 * * * .../check_gamdok_alert.py

# 22:30 코웍(웹 이벤트) 수령 리마인드
30 22 * * * .../check_cowork_alert.py
```

12:30·22:30 리마인드는 **수령 여부 파일을 보고 안 돼있으면 폰으로 찌른다**. 자동화가 말없이 실패하는 걸 막는 안전망.

---

## 하면서 배운 것

- **GUI 세션 분리는 반드시 걸림돌로 튀어나온다.** Windows에서 원격 GUI 자동화는 "GUI 안 상시 리스너" 패턴이 정답
- **pyautogui 실패 시 SendInput 직접 호출**. 보안 모듈이 보기엔 둘이 다르다
- **"LLM에게 역할을 엄격히 제한하라"**. 좌표·문자열·스크롤 같은 **기계적 동작은 코드가 하드코딩**, 변하는 **UI 해석만 LLM이 한다**. 이 원칙 못 지키면 LLM이 멋대로 "다 됐습니다" 하고 끝낸다
- **4분할 비교가 통짜 비교보다 강함**. 거짓 양성 확 줄어듦
- **계정 보호 로직은 "성공시킬 방법"이 아니라 "멈출 조건"**. 자동화가 내 자산을 건드리게 만들 땐 멈추는 게 진보시키는 것보다 중요
- **CDP 경로가 막히면 확장 경로로**. Claude in Chrome은 사용자 세션에 얹히는 구조라서 자동화 탐지·캡차를 자연스럽게 우회
- **프롬프트가 곧 명세서**. eventtaker_prompt.md는 요구사항·금지사항·시간대 규약·실패 포맷 전부 담은 "단일 진실원본". 코드 바꿀 일이 생기면 프롬프트만 고친다
- **cron은 봇을 거치지 않는다**. 텔레그램 봇이 죽어도 cron은 직접 돌아감. 관심사 분리

---

## 한계 & TODO

- 해상도 **1920×1080 좌표 하드코딩** — 모니터 바꾸거나 DPI 바뀌면 재측정 필요
- `UAC(EnableLUA=0)` 비활성화 상태 — 보안상 좋지 않음
- 봇 토큰/비밀번호가 **코드에 하드코딩** — 환경변수/.env로 빼야 함
- 게임 패치 후 UI 바뀌면 `ss_reference/*.png` 재촬영 필요 (수동)
- `verify_gamdok_complete()` 는 현재 **항상 True 반환** — 실제 20판 완료 판단은 TODO
- Chrome 확장 상태 감지가 프롬프트 레벨에 있음 — 스크립트 레벨 헬스체크가 더 안전

---

## 마무리

FC Online 자동화 하나치고는 들어간 게 많아 보이지만, 주말 하나 날려서 초안 뽑고 며칠 동안 틈틈이 다듬은 정도다. 결과적으로:

1. **매일 20분** 들던 손품이 0분이 됐다
2. **3-tier 패턴**(cron → 파이 → GUI 리스너 → 자동화 스크립트)과 **하이브리드 자동화 전략**(SendInput + Claude in Chrome)은 다른 자동화에도 그대로 재사용됨 (실제로 아침 루틴 알림 `goodmorning` 자동화에 복붙해 씀)
3. 무엇보다 **Claude Code를 도메인-특화 에이전트로 길들이는 법**을 많이 배움

관련:
- [Telegram Claude Bot — 폰에서 쓰는 개인 AI 에이전트](/projects/telegram-claude-bot)
- [Home Lab — 자취방 네트워크/서버 구성](/projects/home-lab-setup)

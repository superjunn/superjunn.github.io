---
title: "Telegram Claude Bot — 폰에서 쓰는 개인 AI 에이전트"
summary: "Claude Code를 라즈베리파이에 얹고 Telegram으로 연결해서, 어디서든 자연어로 집 서버/데탑을 조작하고 AI 응답을 받는 개인 에이전트."
date: "Apr 11 2026"
draft: false
tags:
- Home Automation
- Raspberry Pi
- Claude Code
---

## 한 줄 요약

자취방 라즈베리파이 5에 **Telegram 봇**을 띄우고, 그 봇이 내 메시지를 그대로 `claude -p` 서브프로세스로 전달한다. 결과적으로 **폰 Telegram 앱이 곧 개인용 Claude Code 터미널**이 된다. 덤으로 집 데탑 WOL, 스크린샷, 원격 재부팅, FC Online 출석 자동화 트리거 같은 홈오토메이션 커맨드까지 한 봇에서 돌린다.

## 왜 만들었나

- 밖에서 갑자기 "아 집 데탑 켜놓고 왔나?" 하는 상황이 많음
- `claude -p`(Claude Code 헤드리스 모드)가 있으니, 텔레그램 메시지를 프롬프트로 바로 넘기면 개인 에이전트가 됨
- 24/7 켜둔 라즈베리파이(이미 `homework_site` 웹서버용으로 운영 중)가 있어서 추가 비용 0

## 전체 구성

```
[ 폰 Telegram ]  ←→  Telegram Bot API
       ↓
[ 라즈베리파이 5 ]
 ├─ telegram-claude-bot.service  (systemd 상주)
 │    python-telegram-bot  + `claude -p` subprocess
 ├─ crontab
 │    ├─ 07:30  auto_start_fconline.py   (FC Online 출석 자동화 트리거)
 │    ├─ 12:30  check_gamdok_alert.py    (감독 수령 리마인드)
 │    ├─ 22:30  check_cowork_alert.py    (코웍 이벤트 리마인드)
 │    └─ 16:58  auto_start_goodmorning.py
 └─ Wake-on-LAN / SSH → 자취방 데스크탑 (Windows)
```

## 핵심 동작

1. Telegram으로 자연어 메시지를 보낸다
2. 봇은 메시지를 `claude -p --output-format stream-json` 프로세스에 stdin으로 넘김
3. Claude의 스트리밍 토큰을 받아 **같은 Telegram 메시지를 실시간 edit**해서 "타이핑 중" 효과
4. 누적 출력이 50KB를 넘기면 자동으로 세션을 compact해서 컨텍스트 관리
5. `/new`로 세션 초기화, 슬래시 커맨드로 집안 기기 제어

## 슬래시 커맨드 요약

| 커맨드 | 용도 |
| --- | --- |
| `/wol` | 데탑을 Wake-on-LAN으로 깨움 (MAC 주소 직접 지정) |
| `/sleep`, `/reboot` | 데탑 원격 절전/재시작 (파이 → SSH → 데탑) |
| `/screenshot` | 데탑 현재 화면 캡처해서 텔레그램으로 전송 |
| `/start_fconline`, `/start_fconline_test` | FC Online 출석/이벤트 자동화 수동 트리거 |
| `/start_gamdok`, `/check_gamdok` | 감독 수령 자동화 시작 / 상태 확인 |
| `/start_eventtaker` (alias `/start_cowork`) | 코웍 이벤트 자동화 |
| `/start_goodmorning` | 아침 루틴 자동화 |
| `/check_event` | 오늘 수령 여부 요약 |
| `/new` | Claude 세션 새로 시작 |
| `/id` | 현재 chat id 확인 (allowlist 등록용) |

## 보안

- `ALLOWED_CHAT_IDS`로 내 chat id만 허용 (allowlist)
- 봇 토큰, 데탑 비밀번호는 코드에 하드코딩하지 말고 환경변수/시크릿으로 빼야 함 (현재는 파이 내부에서만 돌고 있어 하드코딩 상태 — 추후 정리 예정)
- 포트포워딩은 파이의 `ssh(2222)`, `http(80)`, `https(443)`만 열려 있음. 텔레그램은 **아웃바운드 polling** 기반이라 공유기에 추가 포트 안 열어도 동작

## 운영 팁

- `systemctl status telegram-claude-bot` 로 봇 살아있는지 확인
- `~/telegram-claude-bot/bot.log` 가 메인 로그
- `~/telegram-claude-bot/command_history.log` 에 최근 200개 슬래시 커맨드 이력 자동 기록
- `~/telegram-claude-bot/context_backup.json` — 봇 재시작 시 세션 컨텍스트 복구용 스냅샷
- cron은 봇을 거치지 않고 **직접 `venv/bin/python ...py`로 실행**. 봇이 죽어도 스케줄은 계속 돌아가도록 분리

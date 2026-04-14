---
title: "Home Lab — 자취방 공유기 · 라즈베리파이 · 데스크탑 구성"
summary: "24/7 켜둔 라즈베리파이를 게이트웨이로 두고, 데탑은 필요할 때만 WOL로 깨우는 저전력 홈 서버 구성."
date: "Apr 12 2026"
draft: false
tags:
- Home Lab
- Raspberry Pi
- Networking
---

## 전체 그림

```
                    Internet
                       │
                 [ 공유기(GW) ]    포트포워딩: 80, 443, 2222→22
                       │           (그 외 포트는 전부 차단)
         ┌─────────────┼─────────────┐
         │             │             │
   [ Raspberry Pi 5 ]  │       [ Desktop (Windows) ]
    192.168.0.12       │         192.168.0.10
    24/7 상시 가동       │         필요할 때만 WOL로 부팅
         │             │
         └──── 내부 LAN (192.168.0.0/24) ────┘

         [ MacBook ]  — 노마드, 자취방/연구실/외부 이동
```

핵심 원칙은 두 가지:
1. **파이만 항상 켜둔다.** 전력 소모가 작고(5W 수준), 외부 노출 지점을 한 곳으로 몰 수 있음
2. **데탑은 WOL로 깨운다.** 게임 클라이언트/자동화용이라 평소엔 꺼둠. 필요하면 텔레그램 봇으로 `/wol`

## 라즈베리파이 5 — 집의 허브

- **Debian Trixie (aarch64)**
- hostname: `BBscience-site-pi`, 내부 IP `192.168.0.12`
- 외부 접속: `ssh -p 2222 superjunn@bbscience.duckdns.org`

### 올라가 있는 서비스 (systemd)
- `nginx` — 리버스 프록시 + HTTPS 종단 (Let's Encrypt)
- `homework_site.service` — Gunicorn 2 workers, 127.0.0.1:8000 (Python/PostgreSQL 웹앱)
- `telegram-claude-bot.service` — 개인 AI 에이전트 봇 ([별도 포스트](/projects/telegram-claude-bot))
- `stock-advisor-bot.service` — 주식 자동 분석/알림 봇
- `pully-news-bot.service` — 지정학 뉴스 다이제스트 봇
- crontab — DuckDNS 갱신(5분), FC Online 자동화 트리거(07:30) 등

### DNS & 인증서
- **DuckDNS**로 `bbscience.duckdns.org` 운영. 공유기 공인 IP 바뀌면 `~/duckdns/duck.sh`가 5분마다 갱신
- **Let's Encrypt**로 HTTPS. `certbot`이 자동 갱신
- **dnsmasq**로 내부 헤어핀 NAT 우회 → 내부에서도 `bbscience.duckdns.org` 가 바로 내부 IP로 해석됨

## 데스크탑 — 필요할 때만 켜는 워크호스

- Windows, 내부 IP `192.168.0.10`, 계정 `PullyCom`
- 공유기에서 외부 포트 노출 **안 함**. 모든 접근은 파이를 경유
  ```
  ssh -J superjunn@bbscience.duckdns.org:2222 PullyCom@192.168.0.10
  ```
- **Wake-on-LAN**: 파이에서 `wakeonlan <MAC>` 한 방으로 부팅. 텔레그램 봇의 `/wol` 커맨드가 이걸 감쌈
- 주 용도
  - 게임/자동화 (FC Online 자동화 — 별도 포스트)
  - GPU 필요한 작업
  - Parsec/원격 데스크탑으로 직접 접속하는 경우

## 외부 접속 경로

| 위치 | 경로 |
| --- | --- |
| 자취방 내부망 | `ssh superjunn@192.168.0.12` → (원하면) 데탑 ssh |
| 외부 (LTE/다른 와이파이) | `ssh -p 2222 superjunn@bbscience.duckdns.org` |
| 맥북으로 외부에서 접속 | 필요하면 원격 로그인 켜두고 파이 점프: `ssh -J superjunn@bbscience.duckdns.org:2222 pullybook@<맥북IP>` |

## 왜 이렇게 구성했나

- **공격면 최소화**: 공유기에 뚫린 포트는 3개(80/443/2222). 그 외엔 전부 내부망 전용
- **전기료**: 라즈베리파이 5W × 24h × 30d ≈ 3.6kWh/월. 데탑은 평소 꺼둬서 유의미한 누수 없음
- **단일 진입점**: 모든 외부 접속이 파이 한 곳으로 들어오니, 로그 모니터링·fail2ban 같은 방어 장치를 한 번만 세팅하면 됨
- **봇 덕분에 커맨드라인 생략**: 폰에서 텔레그램으로 `/wol`, `/screenshot`, `/sleep` 한 줄이면 됨

## 여기서 끝난 게 아님

- 이 구성 위에서 돌아가는 구체적인 워크로드들은 각자 별도 포스트로:
  - [Telegram Claude Bot](/projects/telegram-claude-bot) — 자연어 개인 AI 에이전트
  - FC Online 출석 자동화 — 데탑을 7:30에 깨워서 매일 이벤트 수령 (예정)

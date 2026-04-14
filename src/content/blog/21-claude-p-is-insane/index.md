---
title: "`claude -p` 가 진짜 개사기인 이유"
summary: "Claude의 지능을 '대화'가 아니라 '프로그램 안'에서 서브프로세스로 호출할 수 있다는 점, 그리고 이걸 Claude Max 구독 안에서 공짜로 쓸 수 있다는 점. 이 두 개가 만나면 오픈클로 같은 거 내가 직접 만들어 쓰는 시대가 열린다."
date: "Apr 14 2026"
draft: false
tags:
- AI
- Claude Code
- Essay
---

## `claude -p` 가 뭐냐

Claude Code의 헤드리스 모드. 터미널에서 이렇게 치는 거.

```bash
claude -p "이 JSON을 한국어로 요약해줘" < data.json
```

대화형 REPL이 아니라 **한 번 불러서 한 번 응답받고 끝나는** 서브프로세스. 옵션 몇 개 붙이면:

- `--model claude-opus-4` — 모델 지정
- `--chrome` — 내 Chrome 확장에 붙어서 실제 브라우저 조작
- `--dangerously-skip-permissions` — 권한 확인 스킵
- `--output-format stream-json` — 토큰 스트리밍으로 받기

이게 별 거 아닌 것 같지만, **이거 한 줄이 할 수 있는 일**이 내 인생을 좀 바꿨다.

---

## "대화"가 아니라 "프로그램 안에서 쓰는 지능"

ChatGPT나 Claude 웹 인터페이스는 전부 **사람이 앉아서 치는 걸 전제**로 한다. 내가 프롬프트를 치고, 답을 읽고, 그걸 복사해서 어딘가에 붙인다. LLM이 "외부의 존재"로 머문다.

`claude -p` 는 이 경계를 부순다. **내 파이썬 코드가 `subprocess.run(['claude', '-p', ...])` 한 줄로 Claude를 호출**한다. 응답은 stdout으로 떨어지고, 그걸 내 프로그램이 파싱해서 다음 로직으로 쓴다.

이게 왜 대단하냐면, 지금까지 "코드로 풀기 어려웠던" 문제들이 **한 줄**로 풀린다.

### 예시 1 — FC Online 2차 비밀번호 키패드 인식

2차 로그인 키패드가 매번 숫자 배치가 바뀐다. OCR 튜닝? 템플릿 매칭? 전부 깨지기 쉽다. 내가 한 건:

```python
result = subprocess.run(
    ['claude', '-p', '--model', 'claude-opus-4',
     f'이 이미지의 키패드 숫자 배치를 JSON으로. 이미지: {crop_path}'],
    capture_output=True, text=True, timeout=60
)
numpad = json.loads(extract_json(result.stdout))
```

이게 끝. Opus가 크롭된 이미지 보고 `{"row1": [7,2,9,0,4], "row2": [1,8,3,5,6]}` 한 줄을 뱉는다. OpenCV 튜토리얼 주말 하루 쓸 문제가 **코드 네 줄**이 됐다.

### 예시 2 — 뉴스 요약 봇의 "교수님 프레임"

매일 아침 지정학 뉴스 5개에 KAIST 이승욱 교수님 관점을 덧씌우는 [Pully News Bot](/projects/pully-news-bot) 도 이렇게 돈다:

```python
result = subprocess.run(
    ['claude', '-p', '--model', 'sonnet'],
    input=frame_doc + articles_block,  # professor_frame.md + 오늘 기사 5개
    ...
)
```

시스템 프롬프트에 프레임 문서 때려박고, 유저 프롬프트로 기사 넣으면 Sonnet이 알아서 "주류 해석 + 교수님 프레임이라면 이렇게 볼 여지" 구조로 출력한다. 내 파이썬 코드는 **결과를 텔레그램에 쏘는 일**만 하면 됨.

### 예시 3 — Telegram Claude Bot (폰 = 개인 AI 에이전트)

폰에서 텔레그램으로 자연어를 보내면, 파이의 봇이 **그걸 `claude -p` 에 stdin으로 넘긴다**. 그게 끝. 나머지는 Claude가 한다 — 내 집 데탑을 깨우고 파일 정리하고 스크립트 짜고. [Telegram Claude Bot 포스트](/projects/telegram-claude-bot) 참고.

**핵심 패턴은 늘 같다**: *내 프로그램의 로직 중간에 "지능이 필요한 한 점"이 있을 때, 그 한 점을 `claude -p` 로 위임한다.* 위임 비용은 서브프로세스 하나 띄우는 값이다.

---

## 진짜 개사기는 **비용 구조**

여기까지는 "편하다" 정도일 수 있다. 진짜 큰 건 다음 이야기다.

### Claude Max 구독 안에서 전부 작동한다

월 몇만 원짜리 Claude Max 구독을 하면, 그 안에 Claude Code가 포함돼 있다. 그리고 `claude -p` 는 **그 구독 쿼터 안에서 돈다**. 즉:

- FC Online 자동화에서 매일 Opus가 이미지 몇 장 분석
- 뉴스 봇에서 매일 아침 Sonnet이 5개 기사 다이제스트 생성
- 주식 봇에서 자연어 질문마다 Claude 호출
- 텔레그램 봇의 에이전트 세션들
- ... 전부 **추가 API 비용 0원**

**API 가격이 얼마나 창렬인지 알면 이게 얼마나 큰지 체감이 온다.** Sonnet 4 input token 1M당 $3, output $15. 위 자동화들 합치면 하루 수십~수백만 토큰 쉽게 먹는다. 순수 API로 돌렸으면 월 수십만 원은 나왔을 거. 그걸 **이미 내고 있는 구독 안에서 공짜로 돌린다.**

### 오픈클로 같은 건 막혔다. 그런데 `claude -p` 는 안 막혔다

Anthropic이 최근에 **써드파티 도구들이 구독 기반 Claude에 붙어서 자기네 서비스 제공하는 걸 막았다**. 오픈클로(OpenClaw) 같은 에이전트 플랫폼들 — 구독 쿼터를 자기네 서비스 백엔드로 끌어 쓰던 애들 — 차단됨. 이유는 뻔하다: 한 사람 구독으로 여러 사람이 공유해 먹거나, 대량 트래픽을 구독 뒤에 숨기는 걸 막으려는 것.

그런데 **내가 내 컴퓨터에서 내 구독으로 `claude -p` 부르는 건 당연히 원래 의도된 사용**이다. 이건 막힐 수가 없다. 막으면 Claude Code 자체가 죽으니까.

즉:
- 오픈클로 같은 써드파티 에이전트 플랫폼은 **막힘**
- 나 같은 개인이 **`claude -p` 로 오픈클로가 해주던 일을 직접 만들어 쓰는 건 전혀 막히지 않음**

결국 **서비스 계층이 Anthropic 본인에게 흡수된 것**이다. 그리고 나는 그걸 공짜로 누린다. 어차피 에이전트·자동화 플랫폼의 핵심 가치는 "지능"이었고, 그 지능을 파는 본사가 구독 안에서 `claude -p`를 열어두는 한, **중간 레이어는 DIY로 충분**하다.

---

## 실제로 내가 만들어 쓰는 것들

전부 `claude -p` 가 심장에 들어있다:

- [**Telegram Claude Bot**](/projects/telegram-claude-bot) — 폰에서 자연어 쏘면 `claude -p` 서브프로세스로 개인 AI 에이전트가 됨. 집 데탑 원격 제어, 코드 수정, 쉘 명령 전부
- [**Pully News Bot**](/projects/pully-news-bot) — 매일 아침 교수님 프레임으로 지정학 다이제스트. 모델은 Sonnet 고정
- [**Stock Advisor**](/projects/stock-advisor) — 실시간 주식 데이터에 `claude -p` 자연어 레이어 씌움. API 비용 없이도 애널리스트 흉내 가능
- [**FC Online 자동화**](/projects/fconline-auto-event) — 2차 로그인 키패드 인식, Part A/C 성공 판정, 웹 이벤트 수령 전부 `claude -p` + Claude in Chrome

각각 만들 때 **"Claude가 한 번 판단해주면 되는 그 한 점"을 서브프로세스로 도려낸다**. 그 주변은 전통적인 코드. 이 조합이 혼자서 대량의 자동화를 가능하게 했다.

---

## 정리하면

1. **`claude -p` 는 "LLM을 프로그램 구성요소로 쓰게 해주는 API"** 다. 단, HTTP API가 아니라 stdin/stdout API.
2. **비용 구조가 사기급이다.** Claude Max 구독 안에서 무제한에 가깝게 쓸 수 있다. API였으면 월 수십만 원 나올 양.
3. **써드파티 에이전트 플랫폼은 막혀도 `claude -p` 는 안 막힌다.** 중간 레이어 서비스를 쓰는 게 아니라 본사 CLI를 바로 부르기 때문.
4. **"오픈클로 해주던 거 내가 만들어 쓰면 된다"** 의 시대. 실제로 만들어 쓰고 있고, 그게 이 블로그의 Side Projects 전부다.

Claude Code가 "AI 코딩 도구"로만 알려져 있는데, 진짜 물건은 **`-p` 플래그**다. 이거 쓰기 시작하면 "사람이 쳐야 하는 일"과 "프로그램이 할 수 있는 일" 사이 경계가 움직인다. 많이.

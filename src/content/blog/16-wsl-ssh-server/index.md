---
title: "WSL에서 ssh 서버 열고 외부접속하기"
summary: "GCP 막혔을 때 대안으로, 데스크탑 WSL에 SSH 서버 열고 공유기 포트포워딩해서 외부에서 접속하기."
date: "Sep 25 2022"
draft: false
tags:
- SSH
- WSL
---

평소 리눅스를 사용해야 할 경우에는 맥북 터미널에서 ssh로 구글에서 제공해주는 리눅스 서버에(GCP) 접속했었다. 그러나 어떤 이유로 인해 gcp를 사용하지 못하고 있어서 ㅜㅜ, 데스크탑에 깔아둔 wsl에 ssh로 접속하기로 마음 먹었다.



방법을 내가 열심히 정리하면 더 좋겠지만, 아래 분이 참 잘 정리해주셨으니 ㅎㅎ

[https://parksb.github.io/article/21.html](https://parksb.github.io/article/21.html)

[

**📡 WSL에서 SSH 서버 열기: 학교에서 아이패드로 코딩하기**
SSH(Secure Shell)는 안전하게 원격 접속을 하기 위해 사용하는 프로토콜이다. 윈도우 데스크탑에서 SSH 서버를 열면 아이패드에서 원격으로 데스크탑 쉘에 접속을 할 수 있다. WSL(Windows Subsystem for Linux)은 윈도우의 서브시스템에 리눅스를 탑재하는 기술이다. 아직 부드럽게 작동하지 않...

parksb.github.io

](https://parksb.github.io/article/21.html)

wsl2 에서는 데탑에 설치된 리눅스가 데탑과 같은 ip주소를 사용하는 대신, 가상의 새로운 ip주소를 부여받는데, 여기서 방화벽에 의한 문제가 생기나보다,, 그래서 본인은 굳이 wsl2로 업그레이드 안하고 예전부터 사용하던 wsl을 냅뒀다 ㅋㅋ



외부에서 내 데스크탑에 설치된 wsl로 접속이 가능하도록 포트포워딩을 해줘야 하는데, 이걸 해주기 위해서 생활코딩에 정리된 포트와 공유기(router)에 대한 개념도 살짝 배웠다.

[https://opentutorials.org/course/3265/20033](https://opentutorials.org/course/3265/20033)

[

**공유기 (router) - 생활코딩**
공유기 (router) 2018-03-26 10:25:09 수업소개 집집마다 있는 공유기를 전문 용어로는 라우터라고 합니다. 라우터가 하는 일을 살펴봅니다. 그 과정에서 사설 아이피(private ip address)와 공용 아이피(pubilc ip address)의 차이점 또한 알게 됩니다. 강의 댓글을 작성하려면 로그인하셔야 합니다. toonfac 한 달 전 220704 오후 2시 완료 pmxsg 7개월 전 2022.01.14 수강 labis98 11개월 전 20210926 좋은 강의 감사합니다. chimhyangmoo 1년 전...

opentutorials.org

](https://opentutorials.org/course/3265/20033)

요기부터 포트포워딩까지 쭉 따라가보면 대충 무슨 느낌인지 바로 이해함.



끗

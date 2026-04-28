---
title: "ssh config 파일 만들어서 ssh 접속 편하게 하기"
summary: "~/.ssh/config에 Host 별칭 등록해두면 IP 복붙 없이 `ssh gcp` 한 줄로 접속 가능."
date: "Sep 03 2022"
draft: false
tags:
- SSH
- Dev Env
---

개인적으로 공부할 때 간단하게 이용하기 위해 Gcp에서 무료로 만들어놓은 리눅스 서버가 있다.

맥 터미널에서 항상 ssh 명령어를 이용해서 접속한다.



서버의 IP주소는 메모장에 적어둔 것을 보고 쓰지만, ssh config 파일을 만들면 메모장에 들어가서 복붙하지도 않고 ssh로 접속할 수 있다.



터미널에서

cd ~/.ssh 로 들어가서 config 파일을 만든다.

```
cd ~/.ssh
vim config
```

vim 이든 code 든 nano든 뭐든 알아서..

그 담에

```
Host gcp
HostName <server-ip>
User <user>
IdentityFile ~/.ssh/id_rsa
```

만들어주고 저장.

Host : ssh 뒤에 적을 이름 설정

HostName : IP 주소

User : 접속 이름

IdentityFile  : ssh 접속시 비밀번호 적는 파일



파일 만들고 나면

```
ssh gcp
```

라고만 적어도 ssh 접속된다.

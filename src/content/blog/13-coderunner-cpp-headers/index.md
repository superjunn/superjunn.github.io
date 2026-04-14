---
title: "Code Runner Extension에서 C/C++ 헤더 파일 사용하기 (Mac)"
summary: "네이버 블로그에서 가져온 글 (Sep 03 2022)."
date: "Sep 03 2022"
draft: false
tags:
- C++
- Dev Env
- VSCode
---

VS code에서 간단하게 Code Runner Extension을 이용해서 컴파일 하다보면 몇 가지 문제가 생긴다.



- 입력을 받을 수 없음. 터미널에서 실행되도록 설정을 바꿔주면 해결 가능한 문제. 다음에 포스팅 해두겠음.

- 헤더 파일을 사용할 수 없다.



C/C++ 에서 헤더 파일을 사용하기 위해서는 컴파일러가 실행시킬 파일 뿐만 아니라 헤더파일의 소스코드도 같이 컴파일 해줘야 하는데, Code Runner Extension은 실행시킬 파일만 실행시켜서 에러가 뜬다.



참고 : [https://losskatsu.github.io/programming/c-header/#%ED%97%A4%EB%8D%94-%ED%8C%8C%EC%9D%BC%EC%9D%84-%EC%82%AC%EC%9A%A9%ED%95%98%EC%A7%80-%EC%95%8A%EA%B3%A0-%ED%94%84%EB%A1%9C%EA%B7%B8%EB%9E%98%EB%B0%8D%ED%95%98%EA%B8%B0](https://losskatsu.github.io/programming/c-header/#%ED%97%A4%EB%8D%94-%ED%8C%8C%EC%9D%BC%EC%9D%84-%EC%82%AC%EC%9A%A9%ED%95%98%EC%A7%80-%EC%95%8A%EA%B3%A0-%ED%94%84%EB%A1%9C%EA%B7%B8%EB%9E%98%EB%B0%8D%ED%95%98%EA%B8%B0)

[

**[c언어] 헤더(header) 파일이란? 헤더 파일 개념 정리**
헤더(header) 파일이란? 헤더 파일 개념 정리

losskatsu.github.io

](https://losskatsu.github.io/programming/c-header/#%ED%97%A4%EB%8D%94-%ED%8C%8C%EC%9D%BC%EC%9D%84-%EC%82%AC%EC%9A%A9%ED%95%98%EC%A7%80-%EC%95%8A%EA%B3%A0-%ED%94%84%EB%A1%9C%EA%B7%B8%EB%9E%98%EB%B0%8D%ED%95%98%EA%B8%B0)

그렇다고 매번 헤더를 포함하는 파일을 실행시킬 때마다 터미널에서 gcc -o file file.c 를 타이핑하고 있을 수는 없는 노릇이니... 해결 방안을 찾아봤다.



[https://stackoverflow.com/questions/58549853/compiling-header-files-for-c-using-vscode-code-runner/59351703#59351703?newreg=36632fa8c3f347eaaff7d31f1bc97049](https://stackoverflow.com/questions/58549853/compiling-header-files-for-c-using-vscode-code-runner/59351703#59351703?newreg=36632fa8c3f347eaaff7d31f1bc97049)

[

![](img-01.png)

](https://stackoverflow.com/questions/58549853/compiling-header-files-for-c-using-vscode-code-runner/59351703#59351703?newreg=36632fa8c3f347eaaff7d31f1bc97049)
[

**Compiling header files for C++ using VSCode Code Runner**
I am using VSCode and the code runner extension to try to run a simple c++ project with include files. The project is made of a main.cpp: #include <iostream> #include <time.h> #include "

stackoverflow.com

](https://stackoverflow.com/questions/58549853/compiling-header-files-for-c-using-vscode-code-runner/59351703#59351703?newreg=36632fa8c3f347eaaff7d31f1bc97049)

찾았다. ㅋㅋㅋ 감사합니다 ㅠㅠ

스택오버플로우 답변을 요약하자면,

.bash_profile이나 .zshrc를 통해

컴파일러가 헤더파일의 소스코드까지 실행시키는 'cppcompile' 명령어를 만들어서,

Run code가 실행될때 cppcompile을 실행시키도록 설정하라는 것..



본인은 c도 쓰기 위해서 ccompile 도 설정해둠.

```
function cppcompile()
{
filename=$1
re="^\#include \""
while read line
do
if [[ $line =~ $re ]]; then
temp=${line:9}
temp1=${temp#\"}
temp2=${temp1%\.*\"}
g++ -std=c++11 -c $temp2.cpp
fi
done

위의 내용을 터미널에서 sudo code ~/.bash_profile 또는 zsh를 이용중이라면 sudo code ~/.zshrc 를 이용해서 넣어준 뒤,



vscode의 setting.json에서

```
"code-runner.executorMap": {
"c": "cd $dir && ccompile $fileNameWithoutExt",
"cpp": "cd $dir && cppcompile $fileNameWithoutExt",
}
```

요렇게 추가해주면 된다.

그럼 Code Runner로 돌려도 헤더파일 문제 없이 돌아감 ㅠㅠ

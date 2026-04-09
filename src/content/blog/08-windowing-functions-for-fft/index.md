---
title: "FFT에서 Window 함수가 필요한 이유"
summary: "Spectral Leakage가 뭔지, Rectangular/Hann/Hamming/Blackman Window가 각각 어떻게 다른지, 실무에서 어떻게 고르는지 정리."
date: "Apr 09 2026"
draft: false
tags:
- GNSS
- Signal Processing
---

## FFT는 신호가 무한히 반복된다고 가정한다

FFT(Fast Fourier Transform)에 유한 길이 신호를 넣으면, FFT는 그 신호가 주기적으로 끝없이 반복된다고 가정한다. 문제는 신호의 시작과 끝이 매끄럽게 연결되지 않을 때 발생한다. 끝점에서 불연속(Discontinuity)이 생기고, 이것이 **Spectral Leakage** — 실제 없는 주파수 성분이 스펙트럼에 번져 나타나는 현상 — 의 원인이 된다.

왼쪽처럼 끝점이 맞으면 깔끔한 스펙트럼, 오른쪽처럼 안 맞으면 leakage가 퍼진다.

---

## Window 함수란?

FFT 전에 신호에 곱하는 함수. 양 끝을 부드럽게 0으로 눌러줘서 끝점 불연속을 완화한다. 대신 공짜는 아니다 — leakage를 줄이면 주파수 분해능이 떨어지는 트레이드오프가 있다.

---

## 4가지 주요 Window 함수

### 1. Rectangular (사각 윈도우)

```
w(n) = 1
```

사실상 윈도우를 안 쓰는 것. Main lobe가 가장 좁아서 주파수 분해능이 최고지만, side lobe가 가장 높아서 spectral leakage가 최악.

### 2. Hann

```
w(n) = 0.5 - 0.5 * cos(2*pi*n / (N-1))
```

양 끝이 정확히 0으로 내려감. 범용 디폴트. Leakage를 크게 줄이면서 분해능 손실은 적당한 수준.

### 3. Hamming

```
w(n) = 0.54 - 0.46 * cos(2*pi*n / (N-1))
```

Hann이랑 비슷하지만 양 끝이 완전히 0이 아니라 약 0.08에서 멈춤. 첫 번째 side lobe가 Hann보다 낮아서 인접 주파수 간섭 억제에 유리.

### 4. Blackman

```
w(n) = 0.42 - 0.5 * cos(2*pi*n / (N-1)) + 0.08 * cos(4*pi*n / (N-1))
```

cos 항이 2개. Hann이 종 모양이라면 Blackman은 **더 날카로운 종**. 양 끝이 더 급하게 눌려서 side lobe가 최저 — leakage 거의 없음. 대신 main lobe가 가장 넓어서 분해능 손해가 가장 크다. 약한 신호를 강한 신호 옆에서 찾아야 할 때 유용.

---

## Blackman vs Hann — 직관적 차이

```
Hann:     w = 0.5  - 0.5 * cos(2*pi*n/N)              <- cos 1개
Blackman: w = 0.42 - 0.5 * cos(2*pi*n/N) + 0.08 * cos(4*pi*n/N)  <- cos 2개
```

Blackman의 추가 `cos(4*pi*n/N)` 항이 양 끝을 추가로 억제한다. 시간영역에서 보면 Hann보다 경사가 더 급하고, 주파수영역에서 보면 side lobe가 훨씬 낮다.

---

## 핵심 트레이드오프

| Window | 분해능 | Leakage | 용도 |
|--------|--------|---------|------|
| Rectangular | 최고 | 최악 | 끝점이 맞을 때만 |
| Hann | 좋음 | 좋음 | **디폴트 선택** |
| Hamming | 좋음 | 좋음 | 인접 간섭 억제 강화 |
| Blackman | 낮음 | 최고 | 약한 신호 탐지 |

Leakage 억제와 주파수 분해능은 항상 반비례.

---

## 실무 가이드

- GNSS 수신기 Acquisition 단계: 보통 **Hann** 또는 Rectangular
- Leakage를 원천 방지하려면: 샘플 수 N을 2^n으로 설계하고, fs * T가 신호 주기의 정수배가 되도록 설정
- Onboard/FPGA 구현: FFT 길이는 반드시 2^n (Radix-2), window 연산은 LUT(Look-Up Table)로 구현

---

## MATLAB 시각화 코드

4개 window의 시간영역 모양과 주파수영역 dB 비교, 그리고 실제 cos 신호에 각 window를 씌웠을 때 어떻게 찍히는지 확인하는 코드.

```matlab
%% Window Functions Comparison
clear; close all; clc;

%% Parameters
N = 1024;
n = (0:N-1)';

%% Window Functions
w_rect     = ones(N, 1);
w_hann     = 0.5  - 0.5  * cos(2*pi*n/(N-1));
w_hamming  = 0.54 - 0.46 * cos(2*pi*n/(N-1));
w_blackman = 0.42 - 0.5  * cos(2*pi*n/(N-1)) + 0.08 * cos(4*pi*n/(N-1));

%% Plot: Time Domain + Frequency Domain (dB)
figure('Position', [100 100 1200 500]);

subplot(1,2,1); hold on; grid on;
plot(n, w_rect,     'LineWidth', 1.5);
plot(n, w_hann,     'LineWidth', 1.5);
plot(n, w_hamming,  'LineWidth', 1.5);
plot(n, w_blackman, 'LineWidth', 1.5);
xlabel('Sample'); ylabel('Amplitude');
title('Window Functions — Time Domain');
legend('Rectangular','Hann','Hamming','Blackman','Location','south');
ylim([-0.05 1.15]);

Nfft = 8192;
W_rect     = fftshift(fft(w_rect, Nfft));
W_hann     = fftshift(fft(w_hann, Nfft));
W_hamming  = fftshift(fft(w_hamming, Nfft));
W_blackman = fftshift(fft(w_blackman, Nfft));
dB = @(W) 20*log10(abs(W)/max(abs(W)));
faxis_full = (-Nfft/2:Nfft/2-1) / Nfft;

subplot(1,2,2); hold on; grid on;
plot(faxis_full, dB(W_rect),     'LineWidth', 1.2);
plot(faxis_full, dB(W_hann),     'LineWidth', 1.2);
plot(faxis_full, dB(W_hamming),  'LineWidth', 1.2);
plot(faxis_full, dB(W_blackman), 'LineWidth', 1.2);
xlabel('Normalized Frequency'); ylabel('Magnitude [dB]');
title('Window Functions — Frequency Domain');
legend('Rectangular','Hann','Hamming','Blackman','Location','northeast');
xlim([-0.05 0.05]); ylim([-120 5]);

%% Windowed Signal: Hann vs Blackman
f_sig = 50;
x = cos(2*pi*f_sig/N * n);

figure('Position', [100 100 1000 400]);
subplot(1,2,1);
plot(n, x, 'Color', [0.7 0.7 0.7]); hold on; grid on;
plot(n, w_hann, 'r', 'LineWidth', 1.5);
plot(n, -w_hann, 'r', 'LineWidth', 1.5);
plot(n, w_blackman, 'b--', 'LineWidth', 1.5);
plot(n, -w_blackman, 'b--', 'LineWidth', 1.5);
title('Hann & Blackman Window'); xlabel('Sample'); ylabel('Amplitude');
legend('Original cos','Hann','','Blackman','','Location','south');
subplot(1,2,2);
plot(n, x .* w_hann, 'r'); hold on; grid on;
plot(n, x .* w_blackman, 'b--');
title('Windowed Signal'); xlabel('Sample'); ylabel('Amplitude');
legend('Hann','Blackman','Location','south');
```

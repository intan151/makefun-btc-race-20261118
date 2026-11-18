# makefun-btc-race-20261118

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/intan151/makefun-btc-race-20261118/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/intan151/makefun-btc-race-20261118/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A dip-buy trading bot for make.fun's "Race a BTC trading bot live for 24 hours"
bounty. It trades Coinbase Wrapped BTC (cbBTC) against USDC, minute by minute,
on 1-minute on-chain prices — with $1,000 of paper money; nothing is traded for
real. Long only, fully deterministic, no clock, no network, no randomness.

## Strategy

Buy the dip after a sharp multi-hour sell-off has stabilised and started to
bounce, then exit on take-profit, stop-loss or a time cap. One position at a
time, full size, at most a handful of trades per 24 h.

Entry (all must hold, evaluated at each bar close):

- 3-hour return < -150 bps (a real sell-off happened)
- 30-minute return > -20 bps (the fall has stabilised)
- 15-minute return > +10 bps (a small bounce confirms)
- at least 120 bars since the last exit (cooldown, no overtrading)

Exit (while long):

- take profit: close >= entry fill price × 1.015 (+150 bps)
- stop loss: close <= entry fill price × 0.992 (-80 bps)
- time cap: 480 bars after entry

## Dev result

Local grade on the published 24 h dev window (official kit grader,
`grade-local --driver process`):

- **net PnL: +$13.08** (dev gate is > $0 — passes)
- trades: 2 (one round trip), max drawdown 0.64%, fees $0.81
- two executions reproduce byte for byte (deterministic)

For context, every kit baseline loses money on this dev window
(buy-and-hold -$31.63, EMA-cross -$148.17, RSI-Bollinger -$39.92,
ADX-momentum -$75.57, momentum -$23.87), and the perfect-foresight ceiling is
about +$64 — the window drifts -2.8% with ~26 bps full-size round-trip costs,
so most trend rules just bleed fees. The dip-buy rule catches the one clean
recovery and stays positive (+$12.90–$18.39) across wide parameter changes
(drop -100…-200 bps, TP +120…+200 bps, SL -60…-100 bps, hold 360…720 bars).

## Run it

The grader runs `node /bot/main.ts` (Node 22, type stripping). The bot speaks
`agent-fun/bars-replay/v1` through the kit's own shim
(`vendor/makefun-bars.ts`, copied byte for byte from the kit).

---

Entered on [make.fun](https://make.fun/?ref=1c6jcmp6&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards

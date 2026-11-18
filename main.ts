// Dip-buy BTC bot for make.fun btc-race-24h-20261118-1444.
//
// Strategy (long only, $1,000 paper money, 1-minute cbBTC/USDC bars):
//   Buy the dip after a sharp multi-hour sell-off has stabilised and started
//   to bounce, then exit on take-profit, stop-loss or a time cap. One position
//   at a time, full size, at most a handful of trades per 24 h.
//
//   Entry (all must hold, evaluated at each bar close):
//     - 3-hour return < -150 bps        (a real sell-off happened)
//     - 30-minute return > -20 bps      (the fall has stabilised)
//     - 15-minute return > +10 bps      (a small bounce confirms)
//     - at least 120 bars since the last exit (cooldown, no overtrading)
//   Exit (while long):
//     - take profit: close >= entry * 1.015   (+150 bps)
//     - stop loss:   close <= entry * 0.992   (-80 bps)
//     - time cap:    480 bars after entry
//
//   Why this shape: on the published 24 h dev window the price drops ~200 bps,
//   goes flat, then recovers ~200 bps before grinding down. Every standard
//   trend/momentum/mean-reversion rule loses money there after the ~26 bps
//   full-size round-trip cost; this rule catches the one clean recovery with a
//   +$13.08 net PnL in local simulation, and it stays positive (+$12.90..$18.39)
//   across wide parameter changes (drop -100..-200 bps, TP +120..+200 bps,
//   SL -60..-100 bps, hold 360..720 bars), so it is a plateau, not a tuned peak.
//
//   Deterministic: no clock, no environment, no randomness; every decision is
//   a pure function of the bars seen so far. Uses only the kit's own bars shim
//   (vendor/makefun-bars.ts, copied byte for byte).

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Strategy parameters (fractions, bars).
const DROP_N = 180; // 3-hour lookback for the sell-off
const DROP_THR = -0.015; // 3-hour return must be below -150 bps
const STAB_N = 30; // 30-minute lookback for stabilisation
const STAB_THR = -0.002; // 30-minute return must be above -20 bps
const BOUNCE_N = 15; // 15-minute lookback for bounce confirmation
const BOUNCE_THR = 0.001; // 15-minute return must be above +10 bps
const TAKE_PROFIT = 0.015; // +150 bps from entry
const STOP_LOSS = -0.008; // -80 bps from entry
const MAX_HOLD = 480; // bars
const COOLDOWN = 120; // bars after an exit before re-entering
const MAX_SLIPPAGE_BPS = 150; // fills move ~9 bps at full size; 150 bps is ample headroom

/** Closes seen so far (as numbers; ~6.5e9, exact in a double). */
const closes: number[] = [];
/** Fill price of the open position (exact, taken from the batch's fills). */
let entryPx: number | null = null;
/** Fill bar of the open position. */
let entrySeq = -1;
/** Seq of the last exit bar. */
let lastExitSeq = -1_000_000_000;
/** True while a buy order is out waiting for its fill. */
let pendingBuy = false;

/** Return over the last `n` bars, 0 without that much history. */
function ret(n: number): number {
  if (closes.length <= n) return 0;
  return closes[closes.length - 1] / closes[closes.length - 1 - n] - 1;
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(Number(close));

    // Settle the pending buy from this batch's fills (exact fill price).
    if (pendingBuy) {
      for (const f of batch.fills) {
        if (f.symbol === SYMBOL && f.side === 'buy' && f.status === 'filled') {
          entryPx = Number(f.price);
          entrySeq = f.fill_bar;
        }
      }
      pendingBuy = false;
    }

    const holding = state.positions.get(SYMBOL);
    const qty = holding === undefined ? 0n : holding.qty;

    if (qty <= 0n) {
      // Flat: look for a dip-buy setup.
      if (closes.length <= DROP_N) return [];
      if (state.seq - lastExitSeq < COOLDOWN) return [];
      if (ret(DROP_N) < DROP_THR && ret(STAB_N) > STAB_THR && ret(BOUNCE_N) > BOUNCE_THR) {
        const cash = state.cash;
        if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
        // Fallback reference until the fill arrives (next batch overwrites it
        // with the exact fill price).
        entryPx = Number(close);
        entrySeq = state.seq;
        pendingBuy = true;
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    // Long: check exits.
    if (entryPx === null) {
      entryPx = closes[0];
      entrySeq = state.seq;
    }
    const gain = Number(close) / entryPx - 1;
    const held = state.seq - entrySeq;
    if (gain >= TAKE_PROFIT || gain <= STOP_LOSS || held >= MAX_HOLD) {
      lastExitSeq = state.seq;
      entryPx = null;
      return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});

# LinkedIn post draft

I wanted to test a **real product-spread idea** from the **US–Iran** conflict—not a generic “AI built an app” demo.

**The setup:** While Gulf Coast **gasoline** cracks have been supported by the **summer driving** season, **middle distillates** (diesel / heating oil) have often traded much tighter: disrupted shipping, rerouted flows, and **military & logistics demand** can push **distillate cracks** far above normal, sometimes toward extreme levels versus gasoline.

**What I built with Cursor:** A small backtester that pulls **public EIA spot data** (WTI, Gulf Coast gasoline, No.2 heating oil as a distillate proxy), computes **1-1-1 cracks** for each product, and tracks the **distillate−gasoline spread** in $/bbl.

**The rule (simple, testable):**  
**Long** the spread (long distillate crack, short gasoline crack) when the spread’s **fast moving average > slow**; **flat** when that trend reverses. PnL is marked on daily changes in the spread (1,000 bbl per leg). You can still compare **WTI trend** or **3-2-1 crack** strategies in the same UI.

**Why Cursor mattered:** It wired the boring parts—EIA API, Express backtest, React charts, Render deploy—so I could iterate on **economics and signals** in an afternoon instead of a week of plumbing.

This isn’t a production trading system or advice. It’s a **research prototype**: public data → hypothesis from the headlines → backtest you can click through.

**Live demo (desktop):** [your Render URL]  
**Code:** https://github.com/salmasaidane/oil-crack-backtest  

If you’re watching **Hormuz** and **product cracks**, the question isn’t only “where is WTI?”—it’s whether **distillates are decoupling from gasoline**. That’s what this tests.

---

## One-line signal summary (for comments)

**Signal:** daily EIA Gulf Coast gasoline & distillate (HO) spots vs WTI → gasoline crack & distillate crack → spread = distillate − gasoline → long spread when 10-day SMA of spread > 30-day SMA.

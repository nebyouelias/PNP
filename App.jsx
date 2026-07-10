@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:ital,wght@0,300;0,400;0,500;1,400&display=swap');
@import "tailwindcss";

:root {
  --porcelain: #FBF8F2;
  --paper: #F5EFE4;
  --ink: #241B13;
  --ink-soft: #5C5145;
  --gold: #A9853F;
  --gold-deep: #8A6A2C;
  --champagne: #D9C08A;
  --blush: #E9D2C2;
  --line: #E2D8C6;
}

body { margin: 0; }
.pnp-root { font-family: 'Jost', sans-serif; color: var(--ink); background: var(--porcelain); -webkit-font-smoothing: antialiased; }
.f-display { font-family: 'Cormorant Garamond', Georgia, serif; }
.arch { border-radius: 999px 999px 18px 18px; }
.arch-full { border-radius: 999px 999px 0 0; }
.eyebrow { font-size: 11px; letter-spacing: .28em; text-transform: uppercase; font-weight: 500; }
.pnp-input { width: 100%; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; font-family: 'Jost', sans-serif; font-size: 15px; color: var(--ink); outline: none; transition: border-color .15s, box-shadow .15s; }
.pnp-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px #D9C08A55; }
.pnp-label { display: block; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 6px; font-weight: 500; }
.btn-gold { background: linear-gradient(135deg, var(--gold), var(--gold-deep)); color: #fff; letter-spacing: .14em; text-transform: uppercase; font-size: 12px; font-weight: 500; padding: 14px 28px; border-radius: 999px; border: none; cursor: pointer; transition: transform .15s, box-shadow .15s; box-shadow: 0 6px 18px #A9853F44; }
.btn-gold:hover { transform: translateY(-1px); box-shadow: 0 10px 24px #A9853F55; }
.btn-gold:disabled { opacity: .6; cursor: wait; transform: none; }
.btn-ghost { background: transparent; border: 1px solid var(--gold); color: var(--gold-deep); letter-spacing: .14em; text-transform: uppercase; font-size: 12px; font-weight: 500; padding: 13px 26px; border-radius: 999px; cursor: pointer; transition: background .15s; }
.btn-ghost:hover { background: #D9C08A33; }
.card-lift { transition: transform .25s ease, box-shadow .25s ease; }
.card-lift:hover { transform: translateY(-5px); box-shadow: 0 18px 40px rgba(36,27,19,.12); }
.fade-in { animation: pnpFade .5s ease both; }
@keyframes pnpFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .fade-in, .card-lift, .btn-gold { animation: none !important; transition: none !important; } }
.pnp-scroll::-webkit-scrollbar { height: 6px; }
.pnp-scroll::-webkit-scrollbar-thumb { background: var(--champagne); border-radius: 3px; }

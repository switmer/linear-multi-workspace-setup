// Builds the launcher page (one static HTML string). Used by the `open` shim and by sample generation.
// Look follows Linear's: near-black canvas, hairline borders, tight Inter-style type, small radii,
// a rounded-square workspace tile, one quiet primary button.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Same name always gives the same hue, so each workspace keeps its own color.
const hueFor = (name) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export function launcherPage({ label, url, port, opened, expired = false }) {
  const name = esc(label);
  const initial = esc(label[0] ?? "?");
  const hue = hueFor(label);
  const favicon = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${expired ? "#62666d" : `hsl(${hue} 60% 52%)`}"/><text x="16" y="23" font-size="19" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#fff">${initial}</text></svg>`,
  )}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${expired ? "Expired · " : ""}${name} · Linear sign-in</title>
<link rel="icon" href="${favicon}">
<style>
:root{--accent:hsl(${hue} 60% 54%);--bg:#fff;--panel:#fbfbfc;--text:#1b1c1f;--muted:#6f7177;--line:#e4e5e8;--btn-text:#fff}
@media (prefers-color-scheme:dark){:root{--accent:hsl(${hue} 65% 62%);--bg:#08090a;--panel:#101113;--text:#f7f8f8;--muted:#8a8f98;--line:rgba(255,255,255,.08);--btn-text:#08090a}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--text);font:14px/1.5 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased;
background-image:radial-gradient(600px 300px at 50% 0,color-mix(in srgb,var(--accent) 14%,transparent),transparent)}
.card{width:100%;max-width:400px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:28px;box-shadow:0 1px 0 rgba(255,255,255,.03) inset,0 16px 48px rgba(0,0,0,.25)}
.tile{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:var(--accent);color:var(--btn-text);font-weight:600;font-size:18px;margin-bottom:18px}
h1{margin:0;font-size:18px;font-weight:600;letter-spacing:-.02em}
.sub{margin:4px 0 22px;color:var(--muted)}
.sub b{color:var(--text);font-weight:600}
.btn{display:flex;align-items:center;justify-content:center;height:36px;border-radius:8px;background:var(--accent);color:var(--btn-text);font-weight:500;font-size:14px;text-decoration:none;letter-spacing:-.005em}
.btn:hover{filter:brightness(1.08)}
.foot{margin:16px 0 0;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px;display:flex;justify-content:space-between;gap:12px}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#4cb782;margin-right:6px}
.ended .tile{background:var(--line);color:var(--muted)}
.ended .btn{background:transparent;border:1px solid var(--line);color:var(--muted);pointer-events:none;filter:none}
.ended .dot{background:#62666d}
</style></head>
<body class="${expired ? "ended" : ""}">
<main class="card" id="card">
<div class="tile">${initial}</div>
<h1 id="title">${expired ? "This request has ended" : "Codex needs a Linear sign-in"}</h1>
<p class="sub" id="sub">${expired ? "Close this tab. A new one opens if Codex asks again." : `Workspace: <b>${name}</b>. On Linear's page, pick <b>${name}</b>.`}</p>
<a class="btn" id="go" ${expired ? "" : `href="${esc(url)}"`}>${expired ? "Request ended" : `Continue to Linear for ${name}`}</a>
<div class="foot"><span><i class="dot" id="dot"></i><span id="state">${expired ? "Ended" : "Waiting"}</span></span><span>Opened ${esc(opened)}</span></div>
</main>
<script>
const port=${JSON.stringify(port || "")},label=${JSON.stringify(label)};
const go=document.getElementById("go");
function end(){
  document.body.classList.add("ended");
  document.title="Expired · "+label+" · Linear sign-in";
  go.removeAttribute("href");go.textContent="Request ended";
  document.getElementById("title").textContent="This request has ended";
  document.getElementById("sub").textContent="Close this tab. A new one opens if Codex asks again.";
  document.getElementById("state").textContent="Ended";
}
async function alive(){try{await fetch("http://127.0.0.1:"+port+"/",{mode:"no-cors"});return true}catch{return false}}
if(port&&!${expired ? "true" : "false"})setInterval(async()=>{if(!(await alive()))end()},3000);
</script></body></html>`;
}

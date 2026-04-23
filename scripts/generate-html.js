#!/usr/bin/env node
/**
 * generate-certificates.js
 *
 * Scans the repository for .pdf files, auto-categorises them,
 * and writes a fully self-contained index.html to the repo root.
 *
 * Run:  node scripts/generate-certificates.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ── CONFIG ─────────────────────────────────────────────────────────────────

/** Where to look for PDFs (relative to repo root). Checked in order. */
const PDF_DIRS = [
  ".", // repo root (current layout)
  "certificates", // future-proof subfolder
];

/** GitHub browse base URL used for the "View" link on every card. */
const GITHUB_BASE = "https://github.com/maskeynihal/certificates/blob/main/";

/** Output path (repo root). */
const OUTPUT = path.join(__dirname, "..", "www", "index.html");

// ── CATEGORISATION ─────────────────────────────────────────────────────────

const RULES = [
  {
    category: "AWS",
    icon: "☁️",
    test: function (f) {
      return /^aws/i.test(f);
    },
  },
  {
    category: "Security Awareness",
    icon: "🛡️",
    test: function (f) {
      return /hipaa|knowbe4|insider|phishing|phsihing|internet.?sec|travel.?sec|mobile.?dev|captain|jasper|privacy.?law|llm.?sec|ai.?sec|surprise/i.test(
        f,
      );
    },
  },
  {
    category: "Secure Coding",
    icon: "💻",
    test: function (f) {
      return /secure.?cod|secure.?app|owasp/i.test(f);
    },
  },
  {
    category: "Courses",
    icon: "🎓",
    test: function () {
      return true;
    },
  },
];

function categorise(filename) {
  for (var i = 0; i < RULES.length; i++) {
    if (RULES[i].test(filename)) {
      return { category: RULES[i].category, icon: RULES[i].icon };
    }
  }
  return { category: "Courses", icon: "🎓" };
}

// ── ICON OVERRIDES ─────────────────────────────────────────────────────────

const ICON_OVERRIDES = [
  [/hipaa|privacy.*law/i, "🏥"],
  [/mobile.?device/i, "📱"],
  [/travel/i, "✈️"],
  [/jasper/i, "🧳"],
  [/phish/i, "🎣"],
  [/internet.*security/i, "🌐"],
  [/insider/i, "🔍"],
  [/surprise|snapshot/i, "🔒"],
  [/llm|ai.*(fund|sec)/i, "🤖"],
  [/safer.*dep/i, "📦"],
  [/sensitive.*cred/i, "🔑"],
  [/good.*cod/i, "✅"],
  [/owasp/i, "🔟"],
  [/data.*hyg/i, "🧹"],
  [/memory/i, "🧠"],
  [/source.*code/i, "🛡️"],
  [/password/i, "🔐"],
  [/datadog.*101|101.*dev/i, "🐶"],
  [/observ/i, "📈"],
  [/database/i, "🗄️"],
  [/visuali/i, "📊"],
  [/hcu/i, "🎓"],
];

function iconFor(cleanNameStr, defaultIcon) {
  for (var i = 0; i < ICON_OVERRIDES.length; i++) {
    if (ICON_OVERRIDES[i][0].test(cleanNameStr)) return ICON_OVERRIDES[i][1];
  }
  return defaultIcon;
}

// ── NAME CLEANUP ───────────────────────────────────────────────────────────

function cleanName(filename) {
  var n = filename
    .replace(/\.pdf$/i, "")
    .replace(/ - Nihal Maskey$/i, "")
    .trim();

  n = n.replace(/_/g, " ").replace(/\s*-\s*/g, ": ");

  // Split camelCase (SecureApplicationDevelopment → Secure Application Development)
  n = n.replace(/([a-z])([A-Z])/g, "$1 $2");

  n = n.replace(/\s{2,}/g, " ").trim();
  n = n.replace(/:{2,}/g, ":").replace(/:\s*:/g, ":");

  return n;
}

// ── COLLECT PDFs ───────────────────────────────────────────────────────────

const repoRoot = path.resolve(__dirname, "..");

function collectPdfs() {
  var found = [];
  var seen = {};

  PDF_DIRS.forEach(function (dir) {
    var absDir = path.join(repoRoot, dir);
    if (!fs.existsSync(absDir)) return;

    var entries = fs.readdirSync(absDir, { withFileTypes: true });
    entries.forEach(function (entry) {
      if (!entry.isFile()) return;
      if (!entry.name.toLowerCase().endsWith(".pdf")) return;
      var prefix = dir === "." ? "" : dir + "/";
      var relPath = prefix + entry.name;
      if (!seen[relPath]) {
        seen[relPath] = true;
        found.push(relPath);
      }
    });
  });

  found.sort(function (a, b) {
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  return found;
}

// ── BUILD CERT OBJECTS ─────────────────────────────────────────────────────

function buildCerts(files) {
  return files.map(function (relPath) {
    var filename = path.basename(relPath);
    var name = cleanName(filename);
    var cat = categorise(filename);
    var icon = iconFor(name, cat.icon);

    var url =
      GITHUB_BASE + relPath.split("/").map(encodeURIComponent).join("/");

    return { name: name, category: cat.category, icon: icon, url: url };
  });
}

// ── STATS ──────────────────────────────────────────────────────────────────

function countByCategory(certs) {
  var map = {};
  certs.forEach(function (c) {
    map[c.category] = (map[c.category] || 0) + 1;
  });
  return map;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function catClass(c) {
  var m = {
    AWS: "aws",
    "Security Awareness": "security",
    "Secure Coding": "coding",
    Courses: "courses",
  };
  return m[c] || "courses";
}

function tagClass(c) {
  var m = {
    AWS: "tag-aws",
    "Security Awareness": "tag-security",
    "Secure Coding": "tag-coding",
    Courses: "tag-courses",
  };
  return m[c] || "tag-courses";
}

function buildCardsHtml(certs) {
  if (certs.length === 0) {
    return [
      '<div class="empty">',
      '  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">',
      '    <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
      "  </svg>",
      "  <p>No certificates found.</p>",
      "</div>",
    ].join("\n");
  }

  return certs
    .map(function (cert, index) {
      return [
        '<a class="cert-card" href="' +
          escapeHtml(cert.url) +
          '" target="_blank" rel="noopener noreferrer" data-category="' +
          escapeHtml(cert.category) +
          '" style="animation-delay: ' +
          index * 40 +
          'ms;">',
        '  <div class="cert-card-top">',
        '    <div class="cert-icon ' +
          catClass(cert.category) +
          '">' +
          escapeHtml(cert.icon) +
          "</div>",
        '    <svg class="cert-link-icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">',
        '      <path d="M7 17L17 7M7 7h10v10"/>',
        "    </svg>",
        "  </div>",
        '  <div class="cert-name">' + escapeHtml(cert.name) + "</div>",
        '  <span class="cert-tag ' +
          tagClass(cert.category) +
          '">' +
          escapeHtml(cert.category) +
          "</span>",
        "</a>",
      ].join("\n");
    })
    .join("\n");
}

// ── CSS ────────────────────────────────────────────────────────────────────

const CSS = [
  ":root {",
  "  --font-display: 'Bricolage Grotesque', sans-serif;",
  "  --font-body: 'DM Sans', sans-serif;",
  "  --radius: 12px; --radius-sm: 8px;",
  "  --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);",
  "}",
  "[data-theme='dark'] {",
  "  --bg: #080d18; --bg-card: #111827;",
  "  --border: #1e2d4a; --border-soft: #162038;",
  "  --text: #e2e8f6; --text-muted: #7a8aaa; --text-faint: #3d4f70;",
  "  --accent: #5eead4; --accent-dim: rgba(94,234,212,0.12); --accent-glow: rgba(94,234,212,0.06);",
  "  --tag-aws: rgba(255,153,0,0.15);    --tag-aws-text: #ffb347;",
  "  --tag-sec: rgba(239,68,68,0.12);    --tag-sec-text: #f87171;",
  "  --tag-code: rgba(99,102,241,0.15);  --tag-code-text: #a5b4fc;",
  "  --tag-course: rgba(34,197,94,0.12); --tag-course-text: #4ade80;",
  "  --shadow: 0 4px 24px rgba(0,0,0,0.5); --shadow-card: 0 2px 12px rgba(0,0,0,0.4);",
  "  --nm-bg: var(--accent); --nm-text: #080d18;",
  "}",
  "[data-theme='light'] {",
  "  --bg: #f5f7fb; --bg-card: #ffffff;",
  "  --border: #e1e8f5; --border-soft: #edf1fa;",
  "  --text: #0f172a; --text-muted: #64748b; --text-faint: #cbd5e1;",
  "  --accent: #0d9488; --accent-dim: rgba(13,148,136,0.08); --accent-glow: rgba(13,148,136,0.04);",
  "  --tag-aws: rgba(217,119,6,0.1);    --tag-aws-text: #b45309;",
  "  --tag-sec: rgba(220,38,38,0.1);    --tag-sec-text: #dc2626;",
  "  --tag-code: rgba(79,70,229,0.1);   --tag-code-text: #4f46e5;",
  "  --tag-course: rgba(22,163,74,0.1); --tag-course-text: #16a34a;",
  "  --shadow: 0 4px 24px rgba(15,23,42,0.08); --shadow-card: 0 2px 12px rgba(15,23,42,0.06);",
  "  --nm-bg: var(--accent); --nm-text: #ffffff;",
  "}",
  "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
  "html { scroll-behavior: smooth; }",
  "body { font-family: var(--font-body); background: var(--bg); color: var(--text); min-height: 100vh;",
  "  transition: background var(--transition), color var(--transition); -webkit-font-smoothing: antialiased; }",
  "body::before { content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.025;",
  "  background-image: url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\");",
  "  background-size: 200px; }",
  "header { position: sticky; top: 0; z-index: 100; background: var(--bg); border-bottom: 1px solid var(--border-soft);",
  "  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); transition: background var(--transition); }",
  "nav { max-width: 1100px; margin: 0 auto; padding: 0 2rem; height: 64px; display: flex;",
  "  align-items: center; justify-content: space-between; gap: 2rem; }",
  ".nm-logo { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;",
  "  border-radius: 8px; background: var(--nm-bg); color: var(--nm-text); font-family: var(--font-display);",
  "  font-weight: 700; font-size: 0.8rem; letter-spacing: 0.02em; text-decoration: none;",
  "  flex-shrink: 0; transition: opacity 0.2s; }",
  ".nm-logo:hover { opacity: 0.85; }",
  ".nav-links { display: flex; align-items: center; gap: 0.25rem; list-style: none; }",
  ".nav-links a { color: var(--text-muted); text-decoration: none; font-size: 0.875rem; font-weight: 400;",
  "  padding: 0.4rem 0.8rem; border-radius: 6px; transition: color var(--transition), background var(--transition); }",
  ".nav-links a:hover, .nav-links a.active { color: var(--text); background: var(--accent-dim); }",
  ".nav-links a.active { color: var(--accent); font-weight: 500; }",
  ".theme-btn { cursor: pointer; border: 1px solid var(--border); background: transparent; color: var(--text-muted);",
  "  width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;",
  "  transition: all var(--transition); flex-shrink: 0; }",
  ".theme-btn:hover { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }",
  ".theme-btn svg { width: 16px; height: 16px; }",
  ".icon-sun, .icon-moon { display: none; }",
  "[data-theme='dark']  .icon-sun  { display: block; }",
  "[data-theme='light'] .icon-moon { display: block; }",
  "main { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 4rem 2rem 6rem; }",
  ".hero { margin-bottom: 3.5rem; animation: fadeUp 0.6s ease both; }",
  ".hero-eyebrow { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; font-weight: 500;",
  "  letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); margin-bottom: 1rem; }",
  ".hero-eyebrow::before { content: ''; display: block; width: 24px; height: 1.5px; background: var(--accent); }",
  ".hero h1 { font-family: var(--font-display); font-size: clamp(2.2rem, 5vw, 3.5rem); font-weight: 700;",
  "  line-height: 1.1; letter-spacing: -0.03em; color: var(--text); margin-bottom: 1rem; }",
  ".hero h1 span { color: var(--accent); }",
  ".hero p { font-size: 1rem; line-height: 1.7; color: var(--text-muted); max-width: 520px; }",
  ".stats { display: flex; gap: 1.5rem; margin-top: 2rem; flex-wrap: wrap; animation: fadeUp 0.6s 0.1s ease both; }",
  ".stat { display: flex; flex-direction: column; gap: 0.15rem; }",
  ".stat-num { font-family: var(--font-display); font-size: 1.8rem; font-weight: 700; color: var(--text);",
  "  line-height: 1; letter-spacing: -0.04em; }",
  ".stat-num span { color: var(--accent); font-size: 1.1rem; }",
  ".stat-label { font-size: 0.78rem; color: var(--text-muted); letter-spacing: 0.05em; text-transform: uppercase; }",
  ".stat-divider { width: 1px; background: var(--border); align-self: stretch; margin: 0.25rem 0; }",
  ".controls { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2.5rem; }",
  ".search-wrap { position: relative; animation: fadeUp 0.6s 0.12s ease both; }",
  ".search-wrap svg { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);",
  "  color: var(--text-faint); width: 16px; height: 16px; pointer-events: none; }",
  ".search-input { width: 100%; max-width: 420px; background: var(--bg-card); border: 1px solid var(--border);",
  "  border-radius: 100px; color: var(--text); font-family: var(--font-body); font-size: 0.875rem;",
  "  padding: 0.6rem 1rem 0.6rem 2.6rem; outline: none; transition: all var(--transition); }",
  ".search-input::placeholder { color: var(--text-faint); }",
  ".search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }",
  ".filter-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; animation: fadeUp 0.6s 0.15s ease both; }",
  ".filter-btn { cursor: pointer; border: 1px solid var(--border); background: transparent;",
  "  color: var(--text-muted); font-family: var(--font-body); font-size: 0.83rem; font-weight: 400;",
  "  padding: 0.45rem 1rem; border-radius: 100px; transition: all var(--transition);",
  "  display: flex; align-items: center; gap: 0.4rem; white-space: nowrap; }",
  ".filter-btn .count { font-size: 0.72rem; background: var(--border); color: var(--text-faint);",
  "  padding: 0.1rem 0.45rem; border-radius: 100px; transition: all var(--transition); }",
  ".filter-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }",
  ".filter-btn:hover .count { background: var(--accent-dim); color: var(--accent); }",
  ".filter-btn.active { border-color: var(--accent); background: var(--accent-dim); color: var(--accent); font-weight: 500; }",
  ".filter-btn.active .count { background: var(--accent); color: var(--bg); }",
  ".cert-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }",
  ".cert-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);",
  "  padding: 1.4rem 1.6rem; display: flex; flex-direction: column; gap: 0.85rem;",
  "  transition: all var(--transition); cursor: pointer; text-decoration: none; color: inherit;",
  "  position: relative; overflow: hidden; animation: fadeUp 0.5s ease both; box-shadow: var(--shadow-card); }",
  ".cert-card::before { content: ''; position: absolute; inset: 0; background: var(--accent-glow);",
  "  opacity: 0; transition: opacity var(--transition); }",
  ".cert-card:hover { border-color: var(--accent); transform: translateY(-3px);",
  "  box-shadow: var(--shadow), 0 0 0 1px var(--accent); }",
  ".cert-card:hover::before { opacity: 1; }",
  ".cert-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }",
  ".cert-icon { width: 40px; height: 40px; border-radius: var(--radius-sm); display: flex;",
  "  align-items: center; justify-content: center; flex-shrink: 0; font-size: 1.1rem; }",
  ".cert-icon.aws      { background: var(--tag-aws); }",
  ".cert-icon.security { background: var(--tag-sec); }",
  ".cert-icon.coding   { background: var(--tag-code); }",
  ".cert-icon.courses  { background: var(--tag-course); }",
  ".cert-link-icon { color: var(--text-faint); flex-shrink: 0;",
  "  transition: color var(--transition), transform var(--transition); }",
  ".cert-card:hover .cert-link-icon { color: var(--accent); transform: translate(2px, -2px); }",
  ".cert-name { font-family: var(--font-display); font-size: 0.97rem; font-weight: 600;",
  "  line-height: 1.4; color: var(--text); letter-spacing: -0.015em; flex: 1; }",
  ".cert-tag { display: inline-flex; align-items: center; font-size: 0.72rem; font-weight: 500;",
  "  letter-spacing: 0.04em; padding: 0.25rem 0.65rem; border-radius: 100px; width: fit-content; }",
  ".tag-aws      { background: var(--tag-aws);    color: var(--tag-aws-text); }",
  ".tag-security { background: var(--tag-sec);    color: var(--tag-sec-text); }",
  ".tag-coding   { background: var(--tag-code);   color: var(--tag-code-text); }",
  ".tag-courses  { background: var(--tag-course); color: var(--tag-course-text); }",
  ".empty { text-align: center; padding: 5rem 2rem; color: var(--text-muted); grid-column: 1 / -1; }",
  ".empty svg { width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.3; }",
  ".empty p { font-size: 0.95rem; }",
  "footer { position: relative; z-index: 1; border-top: 1px solid var(--border-soft);",
  "  padding: 2rem; text-align: center; }",
  "footer p { font-size: 0.82rem; color: var(--text-faint); }",
  "footer a { color: var(--text-muted); text-decoration: none; }",
  "footer a:hover { color: var(--accent); }",
  "@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }",
  "@media (max-width: 640px) {",
  "  nav { padding: 0 1.25rem; } .nav-links { display: none; }",
  "  main { padding: 2.5rem 1.25rem 4rem; }",
  "  .cert-grid { grid-template-columns: 1fr; } .stats { gap: 1rem; }",
  "}",
].join("\n");

// ── HTML ASSEMBLY ──────────────────────────────────────────────────────────

function generateHtml(certs) {
  var total = certs.length;
  var byCategory = countByCategory(certs);
  var year = new Date().getFullYear();
  var cardsHtml = buildCardsHtml(certs);

  var catList = ["AWS", "Security Awareness", "Secure Coding", "Courses"];
  var catEmoji = {
    AWS: "&#x2601;&#xFE0F;",
    "Security Awareness": "&#x1F6E1;&#xFE0F;",
    "Secure Coding": "&#x1F4BB;",
    Courses: "&#x1F393;",
  };

  // Filter buttons
  var filterBtns = catList
    .filter(function (c) {
      return byCategory[c];
    })
    .map(function (c) {
      return (
        '        <button class="filter-btn" data-filter="' +
        c +
        '">' +
        catEmoji[c] +
        " " +
        c +
        ' <span class="count">' +
        byCategory[c] +
        "</span></button>"
      );
    })
    .join("\n");

  // Stats
  var statsRows = [
    '<div class="stat"><div class="stat-num">' +
      total +
      '</div><div class="stat-label">Total</div></div>',
    '<div class="stat-divider"></div>',
    '<div class="stat"><div class="stat-num">' +
      (byCategory["AWS"] || 0) +
      '<span>+</span></div><div class="stat-label">AWS</div></div>',
    '<div class="stat-divider"></div>',
    '<div class="stat"><div class="stat-num">' +
      (byCategory["Secure Coding"] || 0) +
      '<span>+</span></div><div class="stat-label">Secure Coding</div></div>',
    '<div class="stat-divider"></div>',
    '<div class="stat"><div class="stat-num">' +
      Object.keys(byCategory).length +
      '<span>+</span></div><div class="stat-label">Categories</div></div>',
  ].join("\n        ");

  return [
    "<!DOCTYPE html>",
    '<html lang="en" data-theme="dark">',
    "<head>",
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    "  <title>Nihal Maskey \u2014 Certificates</title>",
    '  <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap" rel="stylesheet" />',
    "  <style>" + CSS + "  </style>",
    "</head>",
    "<body>",
    "",
    "  <header>",
    "    <nav>",
    '      <a href="https://nihal.com.np/" class="nm-logo" title="nihal.com.np">NM</a>',
    '      <ul class="nav-links">',
    '        <li><a href="https://nihal.com.np/#about">About</a></li>',
    '        <li><a href="https://nihal.com.np/#experience">Experience</a></li>',
    '        <li><a href="https://nihal.com.np/#projects">Projects</a></li>',
    '        <li><a href="https://nihal.com.np/#education">Education</a></li>',
    '        <li><a href="#" class="active">Certificates</a></li>',
    '        <li><a href="https://nihal.com.np/#blog">Blog</a></li>',
    "      </ul>",
    "    </nav>",
    "  </header>",
    "",
    "  <main>",
    '    <section class="hero">',
    '      <div class="hero-eyebrow">Nihal Maskey</div>',
    "      <h1>Certificates &amp;<br/><span>Credentials</span></h1>",
    "      <p>A collection of professional certifications in cloud computing, security, and software engineering.</p>",
    '      <div class="stats">',
    "        " + statsRows,
    "      </div>",
    "    </section>",
    "",
    '    <div class="controls">',
    '      <div class="filter-bar">',
    '        <button class="filter-btn active" type="button">All <span class="count">' +
      total +
      "</span></button>",
    filterBtns,
    "      </div>",
    "    </div>",
    "",
    '    <div class="cert-grid">',
    cardsHtml,
    "    </div>",
    "  </main>",
    "",
    "  <footer>",
    "    <p>\u00A9 " +
      year +
      ' <a href="https://nihal.com.np/">Nihal Maskey</a> \u00B7 All rights reserved</p>',
    "  </footer>",
    "</body>",
    "</html>",
  ].join("\n");
}

// ── MAIN ───────────────────────────────────────────────────────────────────

function main() {
  var files = collectPdfs();

  if (files.length === 0) {
    console.warn("[generate-certificates] WARNING: No PDF files found.");
    process.exit(1);
  }

  console.log(
    "[generate-certificates] Found " + files.length + " certificate(s):",
  );
  files.forEach(function (f) {
    console.log("  - " + f);
  });

  var certs = buildCerts(files);
  var html = generateHtml(certs);

  fs.writeFileSync(OUTPUT, html, "utf8");
  console.log(
    "[generate-certificates] Written -> " + path.relative(repoRoot, OUTPUT),
  );
}

main();

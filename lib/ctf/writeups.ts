// Static content for the "Solved CTF" learning feature.
//
// These are challenges I solved in competition (with heavy AI help) and am
// now re-learning properly. Each entry powers a detail page plus one
// runnable/simulated interactive lab. Content is intentionally bundled
// (no DB / network) so it works offline on mobile.

export type CtfCategory = 'Web' | 'Crypto' | 'Pwn';
export type LabId = 'web-ssrf' | 'crypto-nibble' | 'pwn-race';

export interface Concept {
  term: string;
  def: string;
}

export interface ChainStep {
  title: string;
  detail: string;
}

export interface Writeup {
  slug: string;
  /** Short display title. */
  title: string;
  /** Original challenge file name / handle. */
  challenge: string;
  ctf: string;
  category: CtfCategory;
  difficulty: string;
  flag: string;
  /** One line shown on the list card. */
  oneLiner: string;
  /** 2-3 sentence plain-language summary of the whole solve. */
  tldr: string;
  /** The core idea in a single sentence (the "aha"). */
  bigIdea: string;
  /** Background vocabulary, defined simply. */
  concepts: Concept[];
  /** The solve, as an ordered chain. */
  chain: ChainStep[];
  /** Honest dead ends worth remembering. */
  deadEnds: string[];
  /** Portable lessons. */
  takeaways: string[];
  /** Which interactive lab to mount. */
  lab: LabId;
  /** Topics to study next (no links). */
  furtherReading: string[];
}

export const WRITEUPS: Writeup[] = [
  {
    slug: 'songkran-photo-gallery',
    title: 'Songkran Photo Gallery',
    challenge: 'TCTT2026_Web_SongkranPhotoGallery_Buffy',
    ctf: 'TCTT2026',
    category: 'Web',
    difficulty: 'Intermediate',
    flag: 'TCTT2026{songkran_splash_ssrf_to_lfi_chain}',
    oneLiner: 'A "preview a photo from a link" feature became full read access to a hidden internal panel.',
    tldr:
      'The gallery has a form that makes the server fetch any URL you give it. That is SSRF. The server blocks "127.0.0.1" as text, but the same address written as one big number (2130706433) slips through. From inside, the cloud metadata service leaks the secret URL of a hidden "Ops Console", whose file download lets you climb out with ../../ and read flag.txt.',
    bigIdea:
      'If the server fetches a URL for you, you can aim it at the server\'s own private neighbours — and filters usually block a spelling, not an address.',
    concepts: [
      {
        term: 'SSRF (Server-Side Request Forgery)',
        def: 'Normally you fetch a URL. In SSRF, the website\'s server fetches it for you — so it can reach things you cannot, like its own localhost and internal services.',
      },
      {
        term: 'Blocklist bypass',
        def: 'A filter that blocks the text "127.0.0.1" can be fooled, because the same address can be written as a decimal (2130706433), hex (0x7f000001) or octal. Only the dotted spelling was blocked here.',
      },
      {
        term: 'Cloud metadata (IMDS)',
        def: 'Cloud VMs have a magic internal address (169.254.169.254) that answers "who am I, what can I do?". If SSRF can reach it, it often leaks internal details — here, the path of a hidden page.',
      },
      {
        term: 'Path traversal / LFI',
        def: 'A download-by-name feature is meant to stay in one folder. "../" climbs up a folder, so "../../flag.txt" escapes to a file that was supposed to be off-limits.',
      },
    ],
    chain: [
      {
        title: 'Confirm SSRF',
        detail: 'The import form fetched any URL I gave it — proven with a harmless link that came back as fetched content, not an error.',
      },
      {
        title: 'Bypass the private-IP blocklist',
        detail: 'http://127.0.0.1/ was blocked, but http://2130706433/ (the same address as one integer) reached localhost. That is the key bypass.',
      },
      {
        title: 'Read the cloud metadata service',
        detail: 'Reaching 169.254.169.254 (decimal 2852039166) listed internal services. The services path pointed at the hidden ops console.',
      },
      {
        title: 'Get the unguessable ops-console URL',
        detail: 'Metadata handed over http://127.0.0.1:8082/panel-b08a6498 — a random route no wordlist could ever brute-force.',
      },
      {
        title: 'Read the flag with ../../',
        detail: 'The ops console download read files by name. file=../../flag.txt escaped the uploads folder and returned the flag as plain text.',
      },
    ],
    deadEnds: [
      'Guessing public hidden paths (/admin, /.git, /robots.txt) — all 404 or useless.',
      'Path traversal on the PUBLIC download endpoint — properly defended, every payload blocked.',
      'Hex / octal / zero IP forms (0x7f000001, 0177.0.0.1, 0) — only the decimal form was tolerated by the server\'s parser.',
      'Brute-forcing the ops routes with 4,751-line wordlists — the real route was a random token, obtainable only from metadata.',
      'The metadata cloud credentials were a deliberate decoy ("do-not-actually-use-this-it-is-a-ctf-joke"). The prize was the service path, not the keys.',
    ],
    takeaways: [
      'A form field that takes a URL and makes the server fetch it is the classic SSRF tell.',
      'When a private IP is blocked, try the same IP in other notations — filters block the string, not the destination.',
      'Always try the cloud metadata address (169.254.169.254). Even decoy credentials often leak the paths of hidden internal apps.',
      'A different 404 message between two ports is a fingerprint of a second, internal application.',
      'A "download a file by name" feature is a path-traversal / LFI candidate.',
    ],
    lab: 'web-ssrf',
    furtherReading: [
      'OWASP: Server-Side Request Forgery (SSRF) + the SSRF Prevention Cheat Sheet',
      'PortSwigger Web Security Academy: the SSRF labs (incl. blacklist-filter bypass)',
      'HackTricks: SSRF and IP-address obfuscation tricks',
      'Cloud IMDS: AWS EC2 instance metadata service and IMDSv2',
      'RFC 1918 private ranges + "IP address to integer" conversion',
    ],
  },
  {
    slug: 'stupid-encryption',
    title: 'Stupid Encryption',
    challenge: 'TCTT2026_Crypto_StupidEncryption_Buffy',
    ctf: 'TCTT2026',
    category: 'Crypto',
    difficulty: 'Beginner',
    flag: 'TCTT2026{XLAZYXC0D3RX}',
    oneLiner: 'A junior dev\'s homemade cipher with no key — broken by reading it one nibble at a time.',
    tldr:
      'The file was Base64 wrapped around a homemade cipher. Decoding gave a stream of two-letter tokens, each encoding one byte (first letter = high nibble, second = low nibble). The "encryption" was just a keyless nibble complement — a substitution with no secret — so frequency analysis (the commonest byte is the space) and the fact that it is reversible by rule gave up the whole message.',
    bigIdea:
      'A cipher with no key is not encryption — if undoing it needs no secret, anyone who knows the rule can read it.',
    concepts: [
      {
        term: 'Nibble',
        def: 'Half a byte — 4 bits, one hex digit (0-15). The byte 0x54 splits into a high nibble (5) and a low nibble (4). This whole challenge is about nibbles.',
      },
      {
        term: 'Base64',
        def: 'An encoding (not encryption) that turns bytes into printable letters, often ending in "=". It hides nothing — it is a wrapper to peel off first.',
      },
      {
        term: 'Monoalphabetic substitution',
        def: 'Each symbol is always replaced by the same other symbol. Because the mapping never changes, letter frequencies survive — the space stays the commonest symbol, just disguised.',
      },
      {
        term: 'Frequency analysis',
        def: 'Count how often each symbol appears and match it to normal text. The most common byte in English is the space (0x20) — here it showed up as 0x80, which revealed the rule.',
      },
    ],
    chain: [
      {
        title: 'Spot and peel the Base64',
        detail: 'Letters, digits and a trailing "=" scream Base64. Decoding it did NOT give English — it gave two-letter tokens, so there was another layer underneath.',
      },
      {
        title: 'See 16 symbols = nibbles',
        detail: 'The tokens used only 16 distinct letters (A-J, e-j). Sixteen is exactly one nibble. Two letters per token = one byte: first = high nibble, second = low nibble.',
      },
      {
        title: 'Turn tokens into bytes',
        detail: 'A-J map to 0-9, e-j map to 10-15. byte = value(first)*16 + value(second). But the bytes still were not readable — one more layer.',
      },
      {
        title: 'Find the nibble-complement rule',
        detail: 'The commonest byte (a space, 0x20) appeared as 0x80. Comparing them nibble by nibble gave the rule: complement each nibble (roughly "subtract from 10").',
      },
      {
        title: 'Decode everything',
        detail: 'high nibble -> 10 - hi; low nibble -> 10 - lo (for 1-9), 25 - lo (for 10-15), 0 stays 0. That decoded the full message and the flag.',
      },
    ],
    deadEnds: [
      'Assuming Base64 was the whole puzzle — it was only the outer wrapper.',
      'Trying a dictionary/wordlist substitution solver — the custom nibble alphabet made a generic solver the wrong tool.',
      'Reading the nibbles the "obvious" way (no complement) gave V B E <control>... — close-but-wrong, which was itself the clue that a nibble-arithmetic rule was in play.',
    ],
    takeaways: [
      'A file that "looks like Base64" → decode it first, but treat the result as another layer, not the answer.',
      'A suspiciously tiny alphabet is a giveaway. 16 symbols = nibbles; two letters per group = one byte.',
      'The most common byte is almost always the space (0x20). Compare it to the top symbol to reveal the transform.',
      'Any cipher with no key is broken by design — frequency analysis and word patterns finish the job.',
      'Trust the flag from the raw data, not your eyes — re-decode the bytes around { and }.',
    ],
    lab: 'crypto-nibble',
    furtherReading: [
      'Base64 — how it works and why it is not encryption',
      'Number bases: binary, decimal, hexadecimal, and converting between them',
      'Bitwise operations: AND, OR, XOR, shifts (>> and &)',
      'Classical ciphers: Caesar, ROT13, substitution, and Vigenère (the first with a real key)',
      'Frequency analysis and why "don\'t roll your own crypto" is the rule',
    ],
  },
  {
    slug: 'wakeup-dream-monitor',
    title: 'Wakeup // Dream Monitor',
    challenge: 'STDIO2026_Pwn_Wakeup_Buffy',
    ctf: 'STDIO2026',
    category: 'Pwn',
    difficulty: 'Easy',
    flag: 'STDIO2026{2261d535-80f4-4369-a06b-27db4167ca08_[TEAMHASH]}',
    oneLiner: 'Two consoles, one shared dream — win the race between the safety check and when it is used.',
    tldr:
      'Every console shares one server-side session. The WAKE command checks "am I at depth 0?" at one moment, but uses that decision later when you submit a name — a TOCTOU bug. Open two consoles: arm WAKE on B at depth 0, then DIVE on A to push the shared depth to 1 while B\'s name prompt is still open. The check already passed, the kick misses, and you drop into a BusyBox shell.',
    bigIdea:
      'When a program checks a condition and acts on it later, the gap between "check" and "use" is where the bug lives.',
    concepts: [
      {
        term: 'Shared session state',
        def: 'Two connections steering the same server-side state. Console A can see depth changes made by Console B — they share one dream, not one each.',
      },
      {
        term: 'State machine',
        def: 'The console remembers a depth (0-3) and awake/asleep status. Each command moves it. The interesting question is not "what does it check?" but "when does it check vs. act?".',
      },
      {
        term: 'TOCTOU (time-of-check to time-of-use)',
        def: 'A check passes at one moment ("you are at depth 0"), but the action runs later, after the world changed ("you are now at depth 1"). Like a bouncer checking your ticket, then you hand it to a friend.',
      },
      {
        term: 'Landing a shell',
        def: 'When the race drops you into BusyBox ash as user1, you have that user\'s permissions — enough to read /home/user1/flag1.',
      },
    ],
    chain: [
      {
        title: 'Learn the rules',
        detail: 'WAKE only works at depth 0 ("the first dreamer"). At depth >= 1 it is rejected as "unsafe dream activity". Depth is the core state, clamped 0-3.',
      },
      {
        title: 'Prove the session is shared',
        detail: 'Two consoles to the same instance: depth changes on A were visible to B. That means the check and the use can be split across two connections.',
      },
      {
        title: 'Find the real window',
        detail: 'The race is NOT before WAKE. It is between arming WAKE (check passes at depth 0) and submitting the subject name (when the decision is used).',
      },
      {
        title: 'Run the race',
        detail: 'A: SLEEP (depth 0). B: WAKE (check passes, name prompt opens). A: DIVE (shared depth -> 1 while B waits). B: submit name — the kick misses.',
      },
      {
        title: 'Land the shell and read the flag',
        detail: 'You fall into a deeper constructed dream: a BusyBox shell as user1. cat /home/user1/flag1.',
      },
    ],
    deadEnds: [
      'wscat and pip were broken in the environment — a ~80-line stdlib WebSocket client was faster than fixing tooling.',
      'Assuming WAKE at depth >= 1 was the trick — rejected every time. The check is correct; the bug is the window.',
      'Hunting for a format-string bug in the name prompt — it was a plain echo, not printf(user_input).',
      'Flaky instance: 502 / 400 / 418 "I\'m a teapot" / 525 handshakes meant "backend asleep", not "exploit wrong". Retry with backoff.',
      'The flag file held a literal [TEAMHASH] placeholder (a deployment bug), so the platform rejected the otherwise-correct flag.',
    ],
    takeaways: [
      'Read the story text as a technical hint list — "owns the current session" = shared state; "wake at the wrong depth" = check/use disagree.',
      'When a state machine refuses an action, ask WHEN it checks, not just what it checks.',
      'Shared global state + a prompt = a race window. Spend time testing whether two clients share state.',
      'Do not fight broken tooling — a small stdlib client beats repairing the environment.',
      'Always byte-check your flag (od -c, wc -c, md5sum). Zero-vs-O typos are a classic rejection cause.',
    ],
    lab: 'pwn-race',
    furtherReading: [
      'RFC 6455 — the WebSocket protocol (framing, masking, the 101 handshake)',
      'TOCTOU / race condition exploitation',
      'BusyBox and the ash shell in minimal containers',
      'Dropbear SSH and persistence in CTF containers',
      'GZ::CTF dynamic flags: GZCTF_FLAG, [GUID], [TEAM_HASH]',
    ],
  },
];

export function getWriteup(slug: string): Writeup | undefined {
  return WRITEUPS.find((w) => w.slug === slug);
}

// Per-category visual accents, in the app's paper/dusk language.
export const CATEGORY_ACCENT: Record<
  CtfCategory,
  { emoji: string; label: string; paper: string; dusk: string; paperSoft: string; duskSoft: string }
> = {
  Web: {
    emoji: '🕸️',
    label: 'Web',
    paper: 'bg-[#DEE9F2] border-[#B9D0E4] text-[#1B4366]',
    dusk: 'bg-[#1E2938] border-[#31455E] text-sky-300',
    paperSoft: 'bg-[#C7DCED] text-[#1B4366] border-[#A6C7E0]',
    duskSoft: 'bg-sky-950/80 text-sky-300 border-sky-700/60',
  },
  Crypto: {
    emoji: '🔐',
    label: 'Crypto',
    paper: 'bg-[#E6E1F0] border-[#C8BFE0] text-[#3D2E5E]',
    dusk: 'bg-[#28223B] border-[#433963] text-violet-300',
    paperSoft: 'bg-[#D6CDE7] text-[#3D2E5E] border-[#BDB2D6]',
    duskSoft: 'bg-violet-950/80 text-violet-300 border-violet-700/60',
  },
  Pwn: {
    emoji: '💥',
    label: 'Pwn',
    paper: 'bg-[#F2E2DA] border-[#E0C2B4] text-[#5C2E1B]',
    dusk: 'bg-[#332224] border-[#54363A] text-rose-300',
    paperSoft: 'bg-[#E8CFC2] text-[#5C2E1B] border-[#D9B7A6]',
    duskSoft: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
  },
};

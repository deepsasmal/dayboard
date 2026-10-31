/* Follow-up finder for the Meeting view. Plain pattern rules: no network, no model, no AI. Pure functions (globalThis.FU, or module.exports in Node). */
(function () {
  const STOP = new Set("the it this that there we they he she you everyone someone anyone team all also then next so but and if when who what here today tomorrow please ok okay note notes agenda".split(" "));
  const VERB = /^(?:to|will|['’]ll|should|needs? to|has to|have to|is to|agreed to|going to|is going to|owns?|can you)\s+/i;
  const NOT = /^(?:be|not|have|also|probably|likely|miss|join|attend|come|go)\b/i; // "Ravi will be late" is not a task
  const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  const toks = (s) => String(s || "").toLowerCase().split(/[\s,._@-]+/).filter((t) => t.length > 1);
  const same = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && lev(a, b) <= 1);
  /** does the first name `name` belong to someone in `who` (list of display names)? returns that person's display name or "" */
  function who(name, list) { const t = toks(name)[0]; if (!t) return ""; for (const w of list || []) if (toks(w).some((x) => same(x, t))) return String(w).trim(); return ""; }
  /** a due date found in free text: { due: "YYYY-MM-DD" | null, text: the line without that phrase } */
  function dueOf(text, todayISO) {
    const t0 = new Date(todayISO + "T00:00"), dow = t0.getDay(); let m;
    const cut = (re, due) => ({ due, text: text.replace(re, " ").replace(/\s+([,.;])/g, "$1").replace(/\s+/g, " ").trim() });
    if (/\b(?:by\s+)?(?:eod|end of (?:the )?day|today)\b/i.test(text)) return cut(/\b(?:by\s+)?(?:eod|end of (?:the )?day|today)\b/i, todayISO);
    if ((m = text.match(/\b(?:by\s+)?tomorrow\b/i))) return cut(/\b(?:by\s+)?tomorrow\b/i, iso(add(t0, 1)));
    if ((m = text.match(/\b(?:by\s+)?(?:eow|end of (?:the )?week)\b/i))) return cut(/\b(?:by\s+)?(?:eow|end of (?:the )?week)\b/i, iso(add(t0, dow >= 5 || dow === 0 ? 0 : 5 - dow)));
    if ((m = text.match(/\bnext week\b/i))) return cut(/\bnext week\b/i, iso(add(t0, ((8 - dow) % 7) || 7)));
    const wd = /\b(?:(?:by|on|this|next|before)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:by|on|this|next|before)\s+(mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\b/i;
    if ((m = text.match(wd))) { const n = (m[1] || m[2]).toLowerCase(), i = DAYS.findIndex((d) => d.startsWith(n.slice(0, 3))); return cut(wd, iso(add(t0, ((i - dow + 7) % 7) || 7))); }
    const md = /\b(?:(?:by|on|before)\s+)?(?:(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?)\b/i;
    if ((m = text.match(md))) { const day = +(m[1] || m[4]), mo = MON.indexOf((m[2] || m[3]).toLowerCase()); let d = new Date(t0.getFullYear(), mo, day); if (d < t0) d = new Date(t0.getFullYear() + 1, mo, day); if (day >= 1 && day <= 31) return cut(md, iso(d)); }
    const dm = /\b(?:by|on|before)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i;
    if ((m = text.match(dm))) { const day = +m[1]; if (day >= 1 && day <= 31) { let d = new Date(t0.getFullYear(), t0.getMonth(), day); if (d < t0) d = new Date(t0.getFullYear(), t0.getMonth() + 1, day); return cut(dm, iso(d)); } }
    return { due: null, text };
  }
  const SKIP = /^\s*(?:[-*]\s*)?(?:\[\s?[xX ]?\]|(?:todo|action|ai):)/i; // lines the Meeting view already handles
  /** follow-ups hidden in free-form notes: [{ i: line index, title, owner: "me" | name, due, known: bool }] */
  function find(body, o = {}) {
    const list = o.who || [], me = o.me || "", td = o.today, out = [];
    String(body || "").split("\n").forEach((raw, i) => {
      if (SKIP.test(raw) || /^\s*#/.test(raw)) return;
      const line = raw.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "").replace(/[*_`]/g, "").trim();
      if (line.length < 6 || line.length > 200 || /\?\s*$/.test(line)) return;
      let name = null, task = null, m;
      if ((m = line.match(/^(?:action items?|follow[- ]?ups?|next steps?|to-?do)\s*[:\-–—]\s*(.+)$/i))) {
        const n = m[1].match(/^([A-Z][\w’'.-]*)\s*(?::|[-–—]|to\b)\s*(.+)$/); if (n && !STOP.has(n[1].toLowerCase()) && (who(n[1], list) || (me && who(n[1], [me])))) { name = n[1]; task = n[2]; } else { name = "I"; task = m[1]; }
      } else if ((m = line.match(/^(?:I['’]ll|I will|I need to|I have to|I should|I['’]m going to|I am going to|Me to)\s+(.+)$/i))) { name = "I"; task = m[1]; }
      else if ((m = line.match(/^([A-Z][\w’'.-]*(?:\s[A-Z][\w’'.-]*)?)\s+(.+)$/))) {
        const v = m[2].match(VERB); if (!v || STOP.has(m[1].split(/\s+/)[0].toLowerCase())) return; name = m[1]; task = m[2].slice(v[0].length);
      } else return;
      if (!task || NOT.test(task)) return;
      const d = dueOf(task, td || "1970-01-01"); task = d.text.replace(/^(?:please\s+)?/i, "").replace(/[.\s]+$/, ""); if (task.length < 3) return;
      task = task[0].toUpperCase() + task.slice(1);
      const mine = name === "I" || (me && who(name, [me])), person = mine ? "" : who(name, list);
      out.push({ i, title: task, owner: mine ? "me" : person || name.trim(), due: td ? d.due : null, known: mine || !!person });
    });
    return out;
  }
  const api = { find, dueOf, who };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else globalThis.FU = api;
})();

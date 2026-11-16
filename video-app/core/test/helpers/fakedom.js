// Minimal nachgebautes DOM für Tests (Selektoren: Tag, .klasse, #id, Nachfahren per Leerzeichen).
function matchToken(el, tok) {
  const m = tok.match(/^([a-z0-9-]*)((?:[.#][\w-]+)*)$/i);
  if (!m) return false;
  if (m[1] && el.tagName.toLowerCase() !== m[1].toLowerCase()) return false;
  for (const part of m[2].match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.' && !el.className.split(/\s+/).includes(part.slice(1))) return false;
    if (part[0] === '#' && el.id !== part.slice(1)) return false;
  }
  return true;
}
function matches(el, sel) {
  const toks = sel.trim().split(/\s+/);
  if (!matchToken(el, toks[toks.length - 1])) return false;
  let node = el.parentNode;
  for (let i = toks.length - 2; i >= 0; i--) {
    while (node && !(node.tagName && matchToken(node, toks[i]))) node = node.parentNode;
    if (!node) return false;
    node = node.parentNode;
  }
  return true;
}
export class FakeEl {
  constructor(tag) {
    this.tagName = tag;
    this.className = '';
    this.id = '';
    this.attrs = {};
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = {};
    this.textContent = '';
  }
  get children() { return this.childNodes; }
  get firstChild() { return this.childNodes[0] || null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(n) { if (n.parentNode) n.remove(); n.parentNode = this; this.childNodes.push(n); return n; }
  insertBefore(n, ref) {
    if (n.parentNode) n.remove();
    n.parentNode = this;
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i === -1) this.childNodes.push(n); else this.childNodes.splice(i, 0, n);
    return n;
  }
  removeChild(n) { n.remove(); return n; }
  remove() {
    if (!this.parentNode) return;
    const p = this.parentNode;
    p.childNodes.splice(p.childNodes.indexOf(this), 1);
    this.parentNode = null;
  }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  dispatch(type) {
    const e = { type, target: this, stopped: 0, stopPropagation() { this.stopped++; } };
    for (const f of this.listeners[type] || []) f(e);
    return e;
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (n) => { for (const c of n.childNodes) { if (matches(c, sel)) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
export function el(tag, className, children) {
  const e = new FakeEl(tag);
  e.className = className || '';
  for (const c of children || []) e.appendChild(c);
  return e;
}
export function makeDoc() {
  const root = new FakeEl('html');
  const doc = {
    title: '',
    head: null,
    documentElement: root,
    createElement: (t) => new FakeEl(t),
    createElementNS: (ns, t) => new FakeEl(t),
    querySelector: (s) => root.querySelector(s),
    querySelectorAll: (s) => root.querySelectorAll(s),
    addEventListener() {},
    removeEventListener() {},
  };
  return { doc, root };
}

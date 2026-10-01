import { EwoElement as e, css as t, define as n, onThemeChange as r, reducedMotion as i } from "./base.js";
//#region packages/elements/src/halftone.ts
var a = 78, o = 1100, s = .62, c = t`
  :host { display: block; position: relative; aspect-ratio: var(--ewo-halftone-ratio, 4 / 3); contain: strict; color: var(--ewo-fg); }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
`, l = /* @__PURE__ */ new Map();
function u(e) {
	let t = l.get(e);
	return t || (t = (async () => {
		try {
			let t = await (await fetch(e)).blob();
			if (t.type.includes("svg")) throw Error("svg");
			return await createImageBitmap(t, {
				resizeWidth: 720,
				resizeQuality: "high"
			});
		} catch {
			let t = new Image();
			return t.crossOrigin = "anonymous", t.src = e, await t.decode(), t;
		}
	})(), t.catch(() => l.delete(e)), l.set(e, t)), t;
}
var d = () => document.createElement("canvas").getContext("2d", { willReadFrequently: !0 });
function f(e) {
	let t = d();
	t.fillStyle = e, t.fillRect(0, 0, 1, 1);
	let [n, r, i] = t.getImageData(0, 0, 1, 1).data;
	return [
		n,
		r,
		i
	];
}
var p = (e) => 1 - (1 - e) ** 3, m = (e, t = 0, n = 1) => e < t ? t : e > n ? n : e, h = class extends e {
	static styles = [c];
	static observedAttributes = [
		"src",
		"cell",
		"color",
		"alt",
		"fit",
		"origin"
	];
	#e = this.attachInternals();
	#t = document.createElement("canvas");
	#n = this.#t.getContext("2d");
	#r = null;
	#i = null;
	#a = [
		242,
		241,
		238
	];
	#o = !1;
	#s = 0;
	#c = 0;
	#l = null;
	#u = !1;
	#d = 0;
	#f = 0;
	#p = 0;
	#m = new ResizeObserver(() => this.#v());
	#h = null;
	constructor() {
		super(), this.root.append(this.#t), this.#e.role = "img", this.addEventListener("pointermove", (e) => this.#y(e)), this.addEventListener("pointerleave", () => {
			this.#u = !1, this.#b();
		});
	}
	connectedCallback() {
		this.#m.observe(this), this.#h = r(() => {
			this.#_(), this.#x();
		}), this.#_(), this.#g();
	}
	disconnectedCallback() {
		this.#m.disconnect(), this.#h?.(), cancelAnimationFrame(this.#p);
	}
	attributeChangedCallback(e) {
		e === "alt" ? this.#e.ariaLabel = this.getAttribute("alt") : e === "src" ? this.isConnected && this.#g() : this.isConnected && this.#v();
	}
	replay() {
		i() || (this.#f = performance.now(), this.#b());
	}
	async #g() {
		let e = this.getAttribute("src");
		if (e) try {
			let t = await u(e);
			if (e !== this.getAttribute("src")) return;
			this.#r = t, this.#v(), this.hasAttribute("ripple") && this.replay(), this.emit("load");
		} catch {
			this.emit("error");
		}
	}
	#_() {
		let e = getComputedStyle(this);
		this.#a = f(e.color), this.#o = e.getPropertyValue("--ewo-light").trim() === "1";
	}
	#v() {
		let e = this.getBoundingClientRect();
		this.#s = e.width, this.#c = e.height;
		let t = Math.min(2, devicePixelRatio || 1);
		this.#t.width = Math.round(this.#s * t), this.#t.height = Math.round(this.#c * t), this.#n.setTransform(t, 0, 0, t, 0, 0);
		let n = this.#r;
		if (!n || !this.#s || !this.#c) return;
		let r = Number(this.getAttribute("cell")) || 4.6, i = Math.max(4, Math.round(this.#s / r)), a = this.#s / i, o = Math.max(4, Math.round(this.#c / a)), s = n instanceof HTMLImageElement ? n.naturalWidth : n.width, c = n instanceof HTMLImageElement ? n.naturalHeight : n.height, l = this.getAttribute("fit") === "contain" ? Math.min(i / s, o / c) : Math.max(i / s, o / c), u = s * l, f = c * l, p = d();
		p.canvas.width = i, p.canvas.height = o, p.imageSmoothingQuality = "high", p.drawImage(n, (i - u) / 2, (o - f) / 2, u, f);
		let m = p.getImageData(0, 0, i, o).data, h = i * o, g = new Float32Array(h), _ = new Float32Array(h);
		for (let e = 0; e < h; e++) {
			let t = m[e * 4], n = m[e * 4 + 1], r = m[e * 4 + 2];
			g[e] = (.2126 * t + .7152 * n + .0722 * r) / 255, _[e] = m[e * 4 + 3] / 255;
		}
		this.#i = {
			cols: i,
			rows: o,
			cell: a,
			lum: g,
			alpha: _,
			rgb: m
		}, this.#x();
	}
	#y(e) {
		if (!this.hasAttribute("lens") || i() || e.pointerType !== "mouse") return;
		let t = this.getBoundingClientRect();
		this.#l = {
			x: e.clientX - t.left,
			y: e.clientY - t.top
		}, this.#u = !0, this.#b();
	}
	#b() {
		this.#p ||= requestAnimationFrame(() => {
			this.#p = 0;
			let e = +!!this.#u;
			this.#d += (e - this.#d) * .18, Math.abs(e - this.#d) < .01 && (this.#d = e), this.#d || (this.#l = null);
			let t = this.#f > 0 && performance.now() - this.#f < o;
			t || (this.#f = 0), this.#x(), (t || this.#d !== e) && this.#b();
		});
	}
	#x() {
		let e = this.#i, t = this.#n;
		if (t.clearRect(0, 0, this.#s, this.#c), !e) return;
		let { cols: n, rows: r, cell: i, lum: c, alpha: l, rgb: u } = e, d = this.getAttribute("color") === "photo", f = this.#o, h = i * .56, [g, _, v] = this.#a, y = performance.now(), b = this.#f ? (y - this.#f) / o : 1, [x, S] = (this.getAttribute("origin") ?? "0.5 0.4").split(/\s+/).map(Number), C = (x || .5) * this.#s, w = (S || .4) * this.#c, T = Math.hypot(Math.max(C, this.#s - C), Math.max(w, this.#c - w)), E = this.#d > 0 ? this.#l : null, D = this.#d, O = /* @__PURE__ */ new Map(), k = `rgb(${g} ${_} ${v})`;
		for (let e = 0; e < r; e++) for (let t = 0; t < n; t++) {
			let r = e * n + t, o = l[r];
			if (o < .02) continue;
			let y = f ? 1 - c[r] : c[r], x = Math.sqrt(y) * h * o;
			if (x < .25) continue;
			let S = (t + .5) * i, A = (e + .5) * i;
			if (b < 1) {
				let e = Math.hypot(S - C, A - w) / T;
				if (x *= p(m((b - e * .55) / .45)), x < .25) continue;
			}
			if (E) {
				let e = S - E.x, t = A - E.y, n = Math.hypot(e, t);
				if (n < a) {
					let r = (1 - n / a) ** 2 * D;
					x *= 1 + r * .9;
					let o = r * i * 1.4 / Math.max(n, 1);
					S += e * o, A += t * o;
				}
			}
			let j = k;
			if (d) {
				let e = (e, t) => Math.round((e * s + t * .38) / 16) * 16;
				j = `rgb(${e(u[r * 4], g)} ${e(u[r * 4 + 1], _)} ${e(u[r * 4 + 2], v)})`;
			}
			let M = O.get(j);
			M || O.set(j, M = new Path2D()), M.moveTo(S + x, A), M.arc(S, A, x, 0, Math.PI * 2);
		}
		for (let [e, n] of O) t.fillStyle = e, t.fill(n);
	}
};
n("ewo-halftone", h);
//#endregion
export { h as EwoHalftone };

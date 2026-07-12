import React, { useState, useEffect, useRef } from "react";
import { supabase, configured } from "./lib/supabase.js";
import * as THREE from "three";

/* ============================================================
   PNP — Posh & Polished Events · Dallas, TX
   Production build: Vite + React + Supabase (Postgres, Auth, Storage)
   ============================================================ */

const CATEGORIES = [
  "Backdrops",
  "Balloon Garlands & Installations",
  "Table & Chair Rentals",
  "Linens",
  "Centerpieces",
  "Photo Walls",
  "Fringe & Draping",
  "Lighting",
  "Yard Games",
  "Plinths & Pedestals",
];

const EVENT_TYPES = [
  "Birthday", "Baby Shower", "Wedding", "Bridal Shower", "Graduation",
  "Corporate Event", "Anniversary", "Gender Reveal", "Other Celebration",
];

const BUDGET_RANGES = [
  "Under $250", "$250 – $500", "$500 – $1,000", "$1,000 – $2,500", "$2,500+",
  "Not sure yet — advise me",
];

const C = {
  porcelain: "#FBF8F2", paper: "#F5EFE4", ink: "#241B13", inkSoft: "#5C5145",
  gold: "#A9853F", goldDeep: "#8A6A2C", champagne: "#D9C08A", blush: "#E9D2C2", line: "#E2D8C6",
};

const HERO_IMAGE = "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/* Resize an image file client-side; returns a JPEG Blob (for Storage upload) or data URL */
const resizeImage = (file, maxW = 1200, quality = 0.8, asDataUrl = false) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        if (asDataUrl) resolve(canvas.toDataURL("image/jpeg", quality));
        else canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/* ---------- data layer ---------- */
const db = {
  async fetchProducts() {
    const { data, error } = await supabase.from("products").select("*").order("sort_order").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async saveProduct(p) {
    const row = { name: p.name, category: p.category, description: p.description, image: p.image, available: p.available };
    if (p.id) {
      const { error } = await supabase.from("products").update(row).eq("id", p.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("products").insert(row);
      if (error) throw error;
    }
  },
  async deleteProduct(id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },
  async uploadPhoto(file) {
    const blob = await resizeImage(file, 1200, 0.8);
    const path = `${Date.now()}-${uid()}.jpg`;
    const { error } = await supabase.storage.from("product-photos").upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
    return data.publicUrl;
  },
  async submitInquiry(q) {
    const { error } = await supabase.from("inquiries").insert({
      type: q.type, items: q.items ?? null, details: q.details,
      vision: q.vision ?? null, budget: q.budget ?? null,
      inspo_link: q.inspoLink ?? null, inspo_image: q.inspoImage ?? null,
    });
    if (error) throw error;
  },
  async fetchInquiries() {
    const { data, error } = await supabase.from("inquiries").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async setInquiryStatus(id, status) {
    const { error } = await supabase.from("inquiries").update({ status }).eq("id", id);
    if (error) throw error;
  },
  async deleteInquiry(id) {
    const { error } = await supabase.from("inquiries").delete().eq("id", id);
    if (error) throw error;
  },
};


/* ---------- 3D & interactive pieces ---------- */

/* Interactive floating-balloon scene (Three.js). Tap a balloon to pop it. */
const BalloonScene = () => {
  const mountRef = useRef(null);
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSmall = window.innerWidth < 768;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 100);
    camera.position.set(0, 0, 14);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xfff4e0, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(4, 6, 8);
    scene.add(key);
    const warm = new THREE.PointLight(0xd9c08a, 40, 50);
    warm.position.set(-5, -2, 6);
    scene.add(warm);

    const palette = [
      { color: 0xa9853f, metalness: 0.95, roughness: 0.2 },
      { color: 0xd9c08a, metalness: 0.9, roughness: 0.25 },
      { color: 0xf5efe4, metalness: 0.3, roughness: 0.35 },
      { color: 0xe9d2c2, metalness: 0.35, roughness: 0.4 },
    ];
    const geo = new THREE.SphereGeometry(1, 32, 32);
    const count = isSmall ? 8 : 14;
    const balloons = [];
    for (let i = 0; i < count; i++) {
      const m = palette[i % palette.length];
      const mat = new THREE.MeshPhysicalMaterial({ color: m.color, metalness: m.metalness, roughness: m.roughness, clearcoat: 0.6, clearcoatRoughness: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      const s = 0.55 + Math.random() * 0.85;
      mesh.scale.set(s, s * 1.18, s);
      mesh.position.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 4);
      mesh.userData = { speed: 0.4 + Math.random() * 0.7, sway: Math.random() * Math.PI * 2, swayAmp: 0.3 + Math.random() * 0.5, baseX: mesh.position.x };
      scene.add(mesh);
      balloons.push(mesh);
    }

    const sparkGeo = new THREE.BufferGeometry();
    const N = 110;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 16;
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const sparkMat = new THREE.PointsMaterial({ color: 0xd9c08a, size: 0.06, transparent: true, opacity: 0.85 });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparks);

    let bursts = [];
    const burstGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const burstMat = new THREE.MeshBasicMaterial({ color: 0xe8cf9a });
    const pop = (balloon) => {
      for (let i = 0; i < 18; i++) {
        const p = new THREE.Mesh(burstGeo, burstMat);
        p.position.copy(balloon.position);
        p.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3), life: 1 };
        scene.add(p);
        bursts.push(p);
      }
      balloon.position.y = -9 - Math.random() * 3;
      balloon.position.x = (Math.random() - 0.5) * 9;
      balloon.userData.baseX = balloon.position.x;
    };

    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    const target = { x: 0, y: 0 };
    const onMove = (e) => {
      const r = mount.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      target.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const onClick = (e) => {
      const r = mount.getBoundingClientRect();
      ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects(balloons)[0];
      if (hit) pop(hit.object);
    };
    mount.addEventListener("pointermove", onMove);
    mount.addEventListener("click", onClick);

    let raf;
    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      balloons.forEach((b) => {
        b.position.y += b.userData.speed * 0.016;
        if (b.position.y > 9) b.position.y = -9;
        b.position.x = b.userData.baseX + Math.sin(t * 0.6 + b.userData.sway) * b.userData.swayAmp;
        b.rotation.y = t * 0.2 + b.userData.sway;
      });
      sparks.rotation.y = t * 0.03;
      bursts = bursts.filter((p) => {
        p.position.add(p.userData.v);
        p.userData.v.y -= 0.006;
        p.userData.life -= 0.022;
        p.scale.setScalar(Math.max(p.userData.life, 0.001));
        if (p.userData.life <= 0) { scene.remove(p); return false; }
        return true;
      });
      camera.position.x += (target.x * 1.2 - camera.position.x) * 0.04;
      camera.position.y += (target.y * 0.8 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    if (prefersReduced) renderer.render(scene, camera);
    else animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      mount.removeEventListener("pointermove", onMove);
      mount.removeEventListener("click", onClick);
      geo.dispose(); sparkGeo.dispose(); burstGeo.dispose();
      balloons.forEach((b) => b.material.dispose());
      sparkMat.dispose(); burstMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);
  return <div ref={mountRef} className="absolute inset-0" style={{ cursor: "pointer" }} />;
};

/* Gold confetti rain fired on successful inquiry submission */
const ConfettiBurst = ({ trigger }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!trigger || !ref.current) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#A9853F", "#D9C08A", "#E9D2C2", "#FFFFFF", "#8A6A2C"];
    const pieces = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: -30 - Math.random() * canvas.height * 0.6,
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 8,
      c: colors[Math.floor(Math.random() * colors.length)],
      vy: 2.5 + Math.random() * 3.5,
      vx: (Math.random() - 0.5) * 2,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
    }));
    let raf;
    const start = performance.now();
    const draw = (now) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (now - start < 3200) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [trigger]);
  if (!trigger) return null;
  return <canvas ref={ref} className="fixed inset-0 z-50 pointer-events-none" />;
};

/* 3D tilt-toward-cursor wrapper with a moving light sheen */
const TiltCard = ({ children, onClick }) => {
  const ref = useRef(null);
  const canHover = typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
  const onMoveTilt = (e) => {
    if (!canHover || !ref.current) return;
    const el = ref.current;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.02)`;
    const sheen = el.querySelector(".tilt-sheen");
    if (sheen) sheen.style.background = `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(255,245,220,.4), transparent 62%)`;
  };
  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(900px)";
    const sheen = el.querySelector(".tilt-sheen");
    if (sheen) sheen.style.background = "transparent";
  };
  return (
    <div ref={ref} onMouseMove={onMoveTilt} onMouseLeave={reset} onClick={onClick} className="relative" style={{ transition: "transform .18s ease", transformStyle: "preserve-3d", cursor: "pointer" }}>
      {children}
      <div className="tilt-sheen absolute inset-0 arch pointer-events-none" style={{ transition: "background .1s" }} />
    </div>
  );
};

/* ---------- small pieces ---------- */

const GoldRule = ({ w = 64 }) => (
  <div className="flex items-center gap-2 my-4">
    <span style={{ width: w, height: 1, background: C.gold, display: "inline-block" }} />
    <span style={{ width: 6, height: 6, background: C.gold, transform: "rotate(45deg)", display: "inline-block" }} />
  </div>
);

const ArchImage = ({ src, alt, className = "", ratio = "125%", full = false }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className={`relative overflow-hidden ${full ? "arch-full" : "arch"} ${className}`} style={{ paddingTop: ratio, background: `linear-gradient(160deg, ${C.blush}, ${C.paper})` }}>
      {!failed && src ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="f-display" style={{ fontSize: 44, color: C.gold, fontStyle: "italic" }}>P&P</span>
        </div>
      )}
    </div>
  );
};

const Toast = ({ toast }) =>
  !toast ? null : (
    <div className="fixed bottom-6 left-1/2 z-50 fade-in" style={{ transform: "translateX(-50%)" }}>
      <div className="px-6 py-3 rounded-full shadow-xl text-sm" style={{ background: C.ink, color: C.champagne, letterSpacing: ".06em" }}>{toast}</div>
    </div>
  );

const Field = ({ label, children, className = "" }) => (
  <div className={className}>
    <label className="pnp-label">{label}</label>
    {children}
  </div>
);

/* ---------- shared inquiry event/contact fields ---------- */
const emptyEventDetails = {
  eventDate: "", eventType: "", guestCount: "", service: "Delivery & pickup",
  address: "", zip: "", name: "", email: "", phone: "", notes: "",
};

const EventDetailFields = ({ d, set }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <Field label="Event date *">
      <input type="date" className="pnp-input" value={d.eventDate} onChange={(e) => set({ ...d, eventDate: e.target.value })} />
    </Field>
    <Field label="Event type *">
      <select className="pnp-input" value={d.eventType} onChange={(e) => set({ ...d, eventType: e.target.value })}>
        <option value="">Select…</option>
        {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
      </select>
    </Field>
    <Field label="Estimated guest count">
      <input type="number" min="1" className="pnp-input" placeholder="e.g. 60" value={d.guestCount} onChange={(e) => set({ ...d, guestCount: e.target.value })} />
    </Field>
    <Field label="Service needed">
      <select className="pnp-input" value={d.service} onChange={(e) => set({ ...d, service: e.target.value })}>
        <option>Delivery & pickup</option>
        <option>Delivery + full setup & styling</option>
        <option>Customer pickup</option>
      </select>
    </Field>
    <Field label="Event address" className="sm:col-span-2">
      <input className="pnp-input" placeholder="Street address or venue name" value={d.address} onChange={(e) => set({ ...d, address: e.target.value })} />
    </Field>
    <Field label="ZIP code *">
      <input className="pnp-input" placeholder="75088" value={d.zip} onChange={(e) => set({ ...d, zip: e.target.value })} />
    </Field>
    <Field label="Your name *">
      <input className="pnp-input" placeholder="Full name" value={d.name} onChange={(e) => set({ ...d, name: e.target.value })} />
    </Field>
    <Field label="Email *">
      <input type="email" className="pnp-input" placeholder="you@email.com" value={d.email} onChange={(e) => set({ ...d, email: e.target.value })} />
    </Field>
    <Field label="Phone *">
      <input type="tel" className="pnp-input" placeholder="(214) 555-0123" value={d.phone} onChange={(e) => set({ ...d, phone: e.target.value })} />
    </Field>
    <Field label="Notes — colors, theme, venue details" className="sm:col-span-2">
      <textarea rows={3} className="pnp-input" placeholder="Tell us about your vision…" value={d.notes} onChange={(e) => set({ ...d, notes: e.target.value })} />
    </Field>
  </div>
);

const validateDetails = (d) => {
  if (!d.eventDate) return "Please choose your event date.";
  if (!d.eventType) return "Please select your event type.";
  if (!d.zip.trim()) return "Please enter the event ZIP code.";
  if (!d.name.trim()) return "Please enter your name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return "Please enter a valid email address.";
  if (!d.phone.trim()) return "Please enter a phone number.";
  return null;
};

/* ============================================================ PUBLIC PAGES */

const Hero = ({ go }) => (
  <section className="relative overflow-hidden" style={{ background: C.porcelain }}>
    <div className="max-w-6xl mx-auto px-6 pt-14 pb-20 grid md:grid-cols-2 gap-12 items-center">
      <div className="fade-in">
        <div className="eyebrow" style={{ color: C.goldDeep }}>Dallas – Fort Worth · Event Rentals & Styling</div>
        <h1 className="f-display mt-5" style={{ fontSize: "clamp(42px, 6vw, 68px)", lineHeight: 1.05, fontWeight: 500 }}>
          Every detail,<br /><em style={{ color: C.goldDeep }}>posh & polished.</em>
        </h1>
        <GoldRule />
        <p style={{ color: C.inkSoft, fontSize: 17, maxWidth: 440, fontWeight: 300, lineHeight: 1.7 }}>
          Luxury backdrops, balloon installations, tables, linens, and lighting for birthdays, showers, weddings, and corporate celebrations across DFW. Browse the collection, build your inquiry list, and receive a custom quote.
        </p>
        <div className="flex flex-wrap gap-4 mt-8">
          <button className="btn-gold" onClick={() => go({ name: "catalog" })}>Browse the collection</button>
          <button className="btn-ghost" onClick={() => go({ name: "custom" })}>Request a custom design</button>
        </div>
      </div>
      <div className="relative fade-in" style={{ animationDelay: ".1s" }}>
        <div className="absolute -inset-4 arch-full hidden md:block" style={{ border: `1px solid ${C.gold}66`, transform: "translate(14px, 14px)" }} />
        <div className="relative arch-full overflow-hidden" style={{ paddingTop: "116%", background: `linear-gradient(170deg, ${C.ink} 0%, #3a2c1c 55%, ${C.goldDeep} 135%)` }}>
          <BalloonScene />
          <div className="absolute bottom-5 left-0 right-0 text-center pointer-events-none">
            <div className="f-display" style={{ color: C.champagne, fontSize: 20, fontStyle: "italic", textShadow: "0 2px 12px rgba(0,0,0,.4)" }}>Posh & Polished Events</div>
            <div className="eyebrow mt-1" style={{ color: "#CBB98F", fontSize: 9 }}>Tap a balloon ✨</div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const CategoryStrip = ({ products, go }) => {
  const cats = CATEGORIES.filter((c) => products.some((p) => p.category === c && p.available));
  return (
    <section className="py-14" style={{ background: C.paper, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="eyebrow" style={{ color: C.goldDeep }}>The Collection</div>
            <h2 className="f-display mt-2" style={{ fontSize: 34, fontWeight: 500 }}>Rent by category</h2>
          </div>
          <button className="eyebrow" style={{ color: C.goldDeep, borderBottom: `1px solid ${C.gold}`, background: "none", cursor: "pointer" }} onClick={() => go({ name: "catalog" })}>View all →</button>
        </div>
        <div className="flex gap-5 overflow-x-auto pb-3 pnp-scroll">
          {cats.map((c) => {
            const p = products.find((x) => x.category === c && x.available);
            return (
              <button key={c} onClick={() => go({ name: "catalog", category: c })} className="flex-shrink-0 w-36 text-center group" style={{ background: "none", border: "none", cursor: "pointer" }}>
                <div className="card-lift"><ArchImage src={p?.image} alt={c} ratio="130%" /></div>
                <div className="mt-3 text-sm" style={{ letterSpacing: ".04em", color: C.ink }}>{c}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const ProductCard = ({ p, onOpen, onAdd }) => (
  <div className="fade-in">
    <TiltCard onClick={() => onOpen(p)}>
      <ArchImage src={p.image} alt={p.name} />
    </TiltCard>
    <div className="pt-4 px-1">
      <div className="eyebrow" style={{ color: C.goldDeep, fontSize: 10 }}>{p.category}</div>
      <h3 className="f-display mt-1" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>{p.name}</h3>
      <p className="mt-1 text-sm" style={{ color: C.inkSoft, fontWeight: 300, lineHeight: 1.6 }}>{p.description.length > 92 ? p.description.slice(0, 92) + "…" : p.description}</p>
      <div className="flex gap-2 mt-4">
        <button className="btn-gold" style={{ padding: "10px 20px", fontSize: 11 }} onClick={() => onOpen(p)}>Inquire</button>
        <button className="btn-ghost" style={{ padding: "9px 18px", fontSize: 11 }} onClick={() => onAdd(p)}>+ Inquiry list</button>
      </div>
    </div>
  </div>
);

const Catalog = ({ products, category, setCategory, onOpen, onAdd }) => {
  const visible = products.filter((p) => p.available && (!category || p.category === category));
  const pill = (active) => ({ letterSpacing: ".1em", textTransform: "uppercase", background: active ? C.ink : "transparent", color: active ? C.champagne : C.inkSoft, border: `1px solid ${active ? C.ink : C.line}`, cursor: "pointer" });
  return (
    <section className="max-w-6xl mx-auto px-6 py-14">
      <div className="text-center mb-10">
        <div className="eyebrow" style={{ color: C.goldDeep }}>Rental Catalog</div>
        <h2 className="f-display mt-2" style={{ fontSize: 40, fontWeight: 500 }}>The Collection</h2>
        <p className="mt-2" style={{ color: C.inkSoft, fontWeight: 300 }}>Quote-only — add pieces to your inquiry list and we'll price your event personally.</p>
      </div>
      <div className="flex gap-2 flex-wrap justify-center mb-10">
        <button onClick={() => setCategory(null)} className="px-4 py-2 rounded-full text-xs" style={pill(!category)}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className="px-4 py-2 rounded-full text-xs" style={pill(category === c)}>{c}</button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="text-center py-20" style={{ color: C.inkSoft }}>
          <p className="f-display" style={{ fontSize: 26 }}>Nothing here yet.</p>
          <p className="mt-2 font-light">Try another category, or request a custom design and we'll create it for you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {visible.map((p) => <ProductCard key={p.id} p={p} onOpen={onOpen} onAdd={onAdd} />)}
        </div>
      )}
    </section>
  );
};

const ProductModal = ({ product, onClose, onAddToList, onSubmitSingle }) => {
  const [qty, setQty] = useState(1);
  const [days, setDays] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [details, setDetails] = useState(emptyEventDetails);
  const [err, setErr] = useState(null);
  const [sending, setSending] = useState(false);
  useEffect(() => { setQty(1); setDays(1); setShowForm(false); setDetails(emptyEventDetails); setErr(null); }, [product?.id]);
  if (!product) return null;
  const submit = async () => {
    const v = validateDetails(details);
    if (v) return setErr(v);
    setSending(true);
    try { await onSubmitSingle({ product, qty, days, details }); }
    catch { setErr("Something went wrong sending your inquiry — please try again."); }
    finally { setSending(false); }
  };
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-6" style={{ background: "rgba(20,14,8,.55)", backdropFilter: "blur(3px)" }} onClick={onClose}>
      <div className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl fade-in" style={{ background: C.porcelain }} onClick={(e) => e.stopPropagation()}>
        <div className="grid sm:grid-cols-5 gap-0">
          <div className="sm:col-span-2 p-6 pb-0 sm:pb-6">
            <ArchImage src={product.image} alt={product.name} ratio="120%" />
          </div>
          <div className="sm:col-span-3 p-6 sm:pl-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="eyebrow" style={{ color: C.goldDeep, fontSize: 10 }}>{product.category}</div>
                <h3 className="f-display mt-1" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15 }}>{product.name}</h3>
              </div>
              <button onClick={onClose} aria-label="Close" className="text-2xl px-2" style={{ color: C.inkSoft, background: "none", border: "none", cursor: "pointer" }}>×</button>
            </div>
            <p className="mt-3 text-sm" style={{ color: C.inkSoft, fontWeight: 300, lineHeight: 1.7 }}>{product.description}</p>
            <p className="mt-3 text-xs" style={{ color: C.goldDeep, letterSpacing: ".08em" }}>QUOTE-ONLY · NO PAYMENT TAKEN ONLINE</p>
            <div className="grid grid-cols-2 gap-4 mt-5">
              <Field label="Quantity"><input type="number" min="1" className="pnp-input" value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value || 1))} /></Field>
              <Field label="Rental days"><input type="number" min="1" className="pnp-input" value={days} onChange={(e) => setDays(Math.max(1, +e.target.value || 1))} /></Field>
            </div>
            <div className="flex flex-wrap gap-3 mt-5">
              <button className="btn-ghost" onClick={() => onAddToList(product, qty, days)}>+ Add to inquiry list</button>
              <button className="btn-gold" onClick={() => setShowForm(!showForm)}>{showForm ? "Hide inquiry form" : "Inquire about this item"}</button>
            </div>
            {showForm && (
              <div className="mt-6 pt-6 fade-in" style={{ borderTop: `1px solid ${C.line}` }}>
                <EventDetailFields d={details} set={(x) => { setDetails(x); setErr(null); }} />
                {err && <p className="mt-3 text-sm" style={{ color: "#A33" }}>{err}</p>}
                <button className="btn-gold w-full mt-5" disabled={sending} onClick={submit}>{sending ? "Sending…" : "Send inquiry — we'll quote within 24 hrs"}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CartPage = ({ cart, setCart, products, onSubmit }) => {
  const [details, setDetails] = useState(emptyEventDetails);
  const [err, setErr] = useState(null);
  const [sending, setSending] = useState(false);
  const update = (id, patch) => setCart(cart.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id) => setCart(cart.filter((it) => it.id !== id));
  const submit = async () => {
    const v = validateDetails(details);
    if (v) return setErr(v);
    setSending(true);
    try { await onSubmit(details); }
    catch { setErr("Something went wrong sending your inquiry — please try again."); }
    finally { setSending(false); }
  };
  return (
    <section className="max-w-4xl mx-auto px-6 py-14">
      <div className="text-center mb-10">
        <div className="eyebrow" style={{ color: C.goldDeep }}>Your Inquiry List</div>
        <h2 className="f-display mt-2" style={{ fontSize: 40, fontWeight: 500 }}>Request your quote</h2>
        <p className="mt-2" style={{ color: C.inkSoft, fontWeight: 300 }}>One form, one combined quote for everything on your list.</p>
      </div>
      {cart.length === 0 ? (
        <div className="text-center py-16" style={{ color: C.inkSoft }}>
          <p className="f-display" style={{ fontSize: 26 }}>Your list is empty.</p>
          <p className="mt-2 font-light">Browse the collection and tap "+ Inquiry list" on anything you love.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-10">
            {cart.map((it) => {
              const p = products.find((x) => x.id === it.productId);
              return (
                <div key={it.id} className="flex gap-4 items-center p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                  <div className="w-16 flex-shrink-0"><ArchImage src={p?.image} alt="" ratio="110%" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="f-display truncate" style={{ fontSize: 19, fontWeight: 600 }}>{it.name}</div>
                    <div className="text-xs" style={{ color: C.inkSoft }}>{p?.category}</div>
                  </div>
                  <Field label="Qty"><input type="number" min="1" className="pnp-input" style={{ width: 72 }} value={it.qty} onChange={(e) => update(it.id, { qty: Math.max(1, +e.target.value || 1) })} /></Field>
                  <Field label="Days"><input type="number" min="1" className="pnp-input" style={{ width: 72 }} value={it.days} onChange={(e) => update(it.id, { days: Math.max(1, +e.target.value || 1) })} /></Field>
                  <button onClick={() => remove(it.id)} aria-label="Remove" className="text-xl px-2" style={{ color: C.inkSoft, background: "none", border: "none", cursor: "pointer" }}>×</button>
                </div>
              );
            })}
          </div>
          <div className="p-6 sm:p-8 rounded-3xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <h3 className="f-display mb-6" style={{ fontSize: 26, fontWeight: 600 }}>Event & contact details</h3>
            <EventDetailFields d={details} set={(x) => { setDetails(x); setErr(null); }} />
            {err && <p className="mt-4 text-sm" style={{ color: "#A33" }}>{err}</p>}
            <button className="btn-gold w-full mt-6" disabled={sending} onClick={submit}>{sending ? "Sending…" : "Submit combined inquiry"}</button>
            <p className="text-center text-xs mt-3" style={{ color: C.inkSoft }}>No payment is taken online — we review every request personally and reply with a custom quote.</p>
          </div>
        </>
      )}
    </section>
  );
};

const CustomDesign = ({ onSubmit }) => {
  const [vision, setVision] = useState("");
  const [budget, setBudget] = useState("");
  const [inspoLink, setInspoLink] = useState("");
  const [inspoImage, setInspoImage] = useState(null);
  const [details, setDetails] = useState(emptyEventDetails);
  const [err, setErr] = useState(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);
  const pickImage = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setInspoImage(await resizeImage(f, 700, 0.72, true)); } catch { setErr("That image couldn't be read — try a JPG or PNG."); }
  };
  const submit = async () => {
    if (!vision.trim()) return setErr("Tell us a little about your vision first.");
    const v = validateDetails(details);
    if (v) return setErr(v);
    setSending(true);
    try { await onSubmit({ vision, budget, inspoLink, inspoImage, details }); }
    catch { setErr("Something went wrong sending your request — please try again."); }
    finally { setSending(false); }
  };
  return (
    <section className="max-w-3xl mx-auto px-6 py-14">
      <div className="text-center mb-10">
        <div className="eyebrow" style={{ color: C.goldDeep }}>Custom Products</div>
        <h2 className="f-display mt-2" style={{ fontSize: 40, fontWeight: 500 }}>Request a custom design</h2>
        <p className="mt-2" style={{ color: C.inkSoft, fontWeight: 300 }}>Don't see it in the catalog? Describe it — custom backdrops, themed installations, full event styling. We'll design it and quote it.</p>
      </div>
      <div className="p-6 sm:p-8 rounded-3xl space-y-6" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
        <Field label="Describe your vision *">
          <textarea rows={4} className="pnp-input" placeholder="e.g. A sage-and-gold safari first birthday: arched backdrop, balloon garland, welcome sign, dessert plinths…" value={vision} onChange={(e) => { setVision(e.target.value); setErr(null); }} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Budget range">
            <select className="pnp-input" value={budget} onChange={(e) => setBudget(e.target.value)}>
              <option value="">Select…</option>
              {BUDGET_RANGES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Inspiration link (Pinterest, Instagram…)">
            <input className="pnp-input" placeholder="https://…" value={inspoLink} onChange={(e) => setInspoLink(e.target.value)} />
          </Field>
        </div>
        <Field label="Inspiration photo (optional)">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
          <div className="flex items-center gap-4">
            <button className="btn-ghost" style={{ padding: "10px 20px", fontSize: 11 }} onClick={() => fileRef.current?.click()}>Upload photo</button>
            {inspoImage && (
              <div className="flex items-center gap-2">
                <img src={inspoImage} alt="Inspiration" className="w-14 h-14 object-cover rounded-xl" />
                <button className="text-xs underline" style={{ color: C.inkSoft, background: "none", border: "none", cursor: "pointer" }} onClick={() => setInspoImage(null)}>Remove</button>
              </div>
            )}
          </div>
        </Field>
        <div className="pt-6" style={{ borderTop: `1px solid ${C.line}` }}>
          <h3 className="f-display mb-5" style={{ fontSize: 24, fontWeight: 600 }}>Event & contact details</h3>
          <EventDetailFields d={details} set={(x) => { setDetails(x); setErr(null); }} />
        </div>
        {err && <p className="text-sm" style={{ color: "#A33" }}>{err}</p>}
        <button className="btn-gold w-full" disabled={sending} onClick={submit}>{sending ? "Sending…" : "Send custom design request"}</button>
      </div>
    </section>
  );
};

const Footer = ({ go }) => (
  <footer style={{ background: C.ink, color: C.champagne }} className="mt-6">
    <div className="max-w-6xl mx-auto px-6 py-14 grid sm:grid-cols-3 gap-10">
      <div>
        <div className="f-display" style={{ fontSize: 30, fontStyle: "italic" }}>P&P</div>
        <p className="mt-2 text-sm font-light" style={{ color: "#CBB98F" }}>Posh & Polished Events<br />Dallas – Fort Worth, Texas</p>
      </div>
      <div>
        <div className="eyebrow mb-3" style={{ color: C.gold }}>Follow along</div>
        <p className="text-sm font-light" style={{ color: "#CBB98F", lineHeight: 2 }}>
          <a href="https://www.instagram.com/pnp_decorations_dallas_events" target="_blank" rel="noreferrer" style={{ color: "#CBB98F" }}>Instagram · @pnp_decorations_dallas_events</a><br />
          <a href="https://www.facebook.com" target="_blank" rel="noreferrer" style={{ color: "#CBB98F" }}>Facebook · Posh and Polished Events – Dallas Decoration</a>
        </p>
      </div>
      <div>
        <div className="eyebrow mb-3" style={{ color: C.gold }}>How it works</div>
        <p className="text-sm font-light" style={{ color: "#CBB98F", lineHeight: 1.8 }}>Browse → build your inquiry list → submit → receive a personal quote. Serving birthdays, showers, weddings & corporate events across DFW.</p>
      </div>
    </div>
    <div className="max-w-6xl mx-auto px-6 pb-8 flex justify-between items-center text-xs" style={{ color: "#8d7c5c" }}>
      <span>© {new Date().getFullYear()} Posh & Polished Events</span>
      <button onClick={() => go({ name: "admin" })} className="underline" style={{ color: "#8d7c5c", background: "none", border: "none", cursor: "pointer" }}>Admin</button>
    </div>
  </footer>
);

/* ============================================================ ADMIN */

const emptyProduct = { name: "", category: CATEGORIES[0], description: "", image: "", available: true };

const ProductForm = ({ initial, onSave, onCancel }) => {
  const [p, setP] = useState(initial || emptyProduct);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try { setP({ ...p, image: await db.uploadPhoto(f) }); setErr(null); }
    catch { setErr("Photo upload failed — check that the product-photos bucket exists and you're signed in."); }
    finally { setBusy(false); }
  };
  return (
    <div className="p-6 rounded-2xl space-y-4" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
      <h4 className="f-display" style={{ fontSize: 22, fontWeight: 600 }}>{initial?.id ? "Edit product" : "Add product"}</h4>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name *"><input className="pnp-input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
        <Field label="Category">
          <select className="pnp-input" value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description *"><textarea rows={3} className="pnp-input" value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} /></Field>
      <Field label="Photo">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-20"><ArchImage src={p.image} alt="" ratio="115%" /></div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          <button className="btn-ghost" style={{ padding: "9px 18px", fontSize: 11 }} disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Uploading…" : "Upload / replace photo"}</button>
          <input className="pnp-input" style={{ maxWidth: 280 }} placeholder="…or paste an image URL" value={p.image?.startsWith("data:") ? "" : p.image} onChange={(e) => setP({ ...p, image: e.target.value })} />
        </div>
      </Field>
      <label className="flex items-center gap-2 text-sm" style={{ color: C.inkSoft }}>
        <input type="checkbox" checked={p.available} onChange={(e) => setP({ ...p, available: e.target.checked })} /> Available for rent (shown on public site)
      </label>
      {err && <p className="text-sm" style={{ color: "#A33" }}>{err}</p>}
      <div className="flex gap-3">
        <button className="btn-gold" disabled={busy} onClick={() => { if (!p.name.trim() || !p.description.trim()) return setErr("Name and description are required."); onSave(p); }}>Save product</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

const STATUS_COLORS = { new: "#A9853F", quoted: "#3E7C4F", closed: "#8a8a8a" };

const Admin = ({ session, products, refreshProducts, showToast }) => {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [authErr, setAuthErr] = useState(null);
  const [tab, setTab] = useState("inquiries");
  const [editing, setEditing] = useState(null);
  const [inquiries, setInquiries] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (session) db.fetchInquiries().then(setInquiries).catch(() => setInquiries([]));
  }, [session]);

  const signIn = async () => {
    setAuthErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setAuthErr("Sign-in failed — check your email and password.");
  };

  if (!session) {
    return (
      <section className="max-w-sm mx-auto px-6 py-24 text-center">
        <div className="eyebrow" style={{ color: C.goldDeep }}>Owner Access</div>
        <h2 className="f-display mt-2 mb-6" style={{ fontSize: 34, fontWeight: 500 }}>Admin sign in</h2>
        <input type="email" className="pnp-input mb-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="pnp-input" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />
        {authErr && <p className="mt-3 text-sm" style={{ color: "#A33" }}>{authErr}</p>}
        <button className="btn-gold w-full mt-4" onClick={signIn}>Sign in</button>
        <p className="mt-4 text-xs" style={{ color: C.inkSoft }}>Owner account is created in the Supabase dashboard (Authentication → Users).</p>
      </section>
    );
  }

  const statusPill = (active, color) => ({ letterSpacing: ".1em", textTransform: "uppercase", background: active ? color : "transparent", color: active ? "#fff" : C.inkSoft, border: `1px solid ${active ? color : C.line}`, cursor: "pointer" });

  return (
    <section className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h2 className="f-display" style={{ fontSize: 34, fontWeight: 500 }}>Admin dashboard</h2>
        <div className="flex gap-2 items-center">
          {["inquiries", "products"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className="px-5 py-2 rounded-full text-xs" style={{ letterSpacing: ".12em", textTransform: "uppercase", background: tab === t ? C.ink : "transparent", color: tab === t ? C.champagne : C.inkSoft, border: `1px solid ${tab === t ? C.ink : C.line}`, cursor: "pointer" }}>
              {t === "inquiries" ? `Inquiries${inquiries ? ` (${inquiries.filter((i) => i.status === "new").length} new)` : ""}` : "Products"}
            </button>
          ))}
          <button className="text-xs underline ml-2" style={{ color: C.inkSoft, background: "none", border: "none", cursor: "pointer" }} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>

      {tab === "products" && (
        <div className="space-y-6">
          {editing ? (
            <ProductForm
              initial={editing === "new" ? null : editing}
              onCancel={() => setEditing(null)}
              onSave={async (p) => {
                try {
                  await db.saveProduct(p);
                  await refreshProducts();
                  setEditing(null);
                  showToast(p.id ? "Product updated" : "Product added");
                } catch { showToast("Save failed — are you signed in?"); }
              }}
            />
          ) : (
            <button className="btn-gold" onClick={() => setEditing("new")}>+ Add product</button>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {products.map((p) => (
              <div key={p.id} className="flex gap-4 items-center p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}`, opacity: p.available ? 1 : 0.55 }}>
                <div className="w-16 flex-shrink-0"><ArchImage src={p.image} alt="" ratio="115%" /></div>
                <div className="flex-1 min-w-0">
                  <div className="f-display truncate" style={{ fontSize: 18, fontWeight: 600 }}>{p.name}</div>
                  <div className="text-xs" style={{ color: C.inkSoft }}>{p.category}{p.available ? "" : " · hidden"}</div>
                </div>
                <button className="text-xs underline" style={{ color: C.goldDeep, background: "none", border: "none", cursor: "pointer" }} onClick={() => setEditing(p)}>Edit</button>
                <button className="text-xs underline" style={{ color: "#A33", background: "none", border: "none", cursor: "pointer" }} onClick={async () => { if (confirm(`Delete "${p.name}"?`)) { await db.deleteProduct(p.id); await refreshProducts(); showToast("Product deleted"); } }}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "inquiries" && (
        <div className="space-y-4">
          {!inquiries ? (
            <p style={{ color: C.inkSoft }}>Loading inquiries…</p>
          ) : inquiries.length === 0 ? (
            <p style={{ color: C.inkSoft }}>No inquiries yet — they'll appear here the moment a customer submits one.</p>
          ) : (
            inquiries.map((q) => (
              <div key={q.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                <button className="w-full text-left p-4 flex flex-wrap items-center gap-3" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setExpanded(expanded === q.id ? null : q.id)}>
                  <span className="px-3 py-1 rounded-full text-xs text-white" style={{ background: STATUS_COLORS[q.status] || C.gold, letterSpacing: ".08em", textTransform: "uppercase" }}>{q.status}</span>
                  <span className="f-display" style={{ fontSize: 19, fontWeight: 600, color: C.ink }}>{q.details?.name || "—"}</span>
                  <span className="text-sm" style={{ color: C.inkSoft }}>{q.type === "custom" ? "Custom design request" : `${q.items?.length || 0} item(s)`} · {q.details?.eventType} · {q.details?.eventDate}</span>
                  <span className="ml-auto text-xs" style={{ color: C.inkSoft }}>{new Date(q.created_at).toLocaleString()}</span>
                </button>
                {expanded === q.id && (
                  <div className="px-5 pb-5 pt-1 fade-in text-sm" style={{ color: C.ink }}>
                    {q.type === "custom" ? (
                      <div className="mb-4 p-4 rounded-xl" style={{ background: C.paper }}>
                        <div className="pnp-label">Vision</div><p className="font-light">{q.vision}</p>
                        {q.budget && <p className="mt-2"><b>Budget:</b> {q.budget}</p>}
                        {q.inspo_link && <p className="mt-1"><b>Inspiration link:</b> <span className="break-all">{q.inspo_link}</span></p>}
                        {q.inspo_image && <img src={q.inspo_image} alt="Inspiration" className="mt-3 w-32 rounded-xl" />}
                      </div>
                    ) : (
                      <div className="mb-4 p-4 rounded-xl" style={{ background: C.paper }}>
                        <div className="pnp-label">Requested items</div>
                        {q.items?.map((it, i) => (
                          <div key={i} className="flex justify-between py-1" style={{ borderBottom: i < q.items.length - 1 ? `1px solid ${C.line}` : "none" }}>
                            <span>{it.name}</span><span style={{ color: C.inkSoft }}>qty {it.qty} · {it.days} day(s)</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 font-light">
                      <p><b>Event:</b> {q.details?.eventType} on {q.details?.eventDate}</p>
                      <p><b>Guests:</b> {q.details?.guestCount || "—"}</p>
                      <p><b>Service:</b> {q.details?.service}</p>
                      <p><b>Location:</b> {q.details?.address || "—"} ({q.details?.zip})</p>
                      <p><b>Email:</b> {q.details?.email}</p>
                      <p><b>Phone:</b> {q.details?.phone}</p>
                      {q.details?.notes && <p className="sm:col-span-2"><b>Notes:</b> {q.details.notes}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {["new", "quoted", "closed"].map((s) => (
                        <button key={s} className="px-4 py-1.5 rounded-full text-xs" style={statusPill(q.status === s, STATUS_COLORS[s])}
                          onClick={async () => { await db.setInquiryStatus(q.id, s); setInquiries(inquiries.map((x) => (x.id === q.id ? { ...x, status: s } : x))); }}>
                          Mark {s}
                        </button>
                      ))}
                      <button className="px-4 py-1.5 rounded-full text-xs ml-auto" style={{ color: "#A33", border: "1px solid #d8b5b5", background: "none", cursor: "pointer" }}
                        onClick={async () => { if (confirm("Delete this inquiry?")) { await db.deleteInquiry(q.id); setInquiries(inquiries.filter((x) => x.id !== q.id)); } }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
};

/* ============================================================ APP */

export default function App() {
  const [view, setView] = useState({ name: "home" });
  const [products, setProducts] = useState(null);
  const [category, setCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [modalProduct, setModalProduct] = useState(null);
  const [toast, setToast] = useState(null);
  const [confetti, setConfetti] = useState(0);
  const [session, setSession] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  const refreshProducts = async () => setProducts(await db.fetchProducts());

  useEffect(() => {
    if (!configured) return;
    refreshProducts().catch(() => setProducts([]));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!configured) {
    return (
      <div className="pnp-root min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="f-display" style={{ fontSize: 34 }}>Almost there</h1>
          <p className="mt-3" style={{ color: C.inkSoft, maxWidth: 480 }}>
            Missing Supabase configuration. Copy <code>.env.example</code> to <code>.env</code> and fill in
            <code> VITE_SUPABASE_URL</code> and <code> VITE_SUPABASE_ANON_KEY</code> (on Vercel, add them under
            Project → Settings → Environment Variables), then rebuild.
          </p>
        </div>
      </div>
    );
  }

  const go = (v) => {
    setView(v);
    if (v.name === "catalog") setCategory(v.category || null);
    window.scrollTo({ top: 0 });
  };

  const addToCart = (product, qty = 1, days = 1) => {
    setCart((prev) => {
      const found = prev.find((it) => it.productId === product.id);
      if (found) return prev.map((it) => (it.productId === product.id ? { ...it, qty: it.qty + qty, days } : it));
      return [...prev, { id: uid(), productId: product.id, name: product.name, qty, days }];
    });
    setModalProduct(null);
    showToast(`"${product.name}" added to your inquiry list`);
  };

  const submitSingle = async ({ product, qty, days, details }) => {
    await db.submitInquiry({ type: "items", items: [{ productId: product.id, name: product.name, qty, days }], details });
    setModalProduct(null);
    showToast("Inquiry sent! We'll be in touch with your quote soon. ✨");
    setConfetti((c) => c + 1);
  };

  const submitCart = async (details) => {
    await db.submitInquiry({ type: "items", items: cart.map(({ productId, name, qty, days }) => ({ productId, name, qty, days })), details });
    setCart([]);
    go({ name: "home" });
    showToast("Combined inquiry sent! Your custom quote is on the way. ✨");
    setConfetti((c) => c + 1);
  };

  const submitCustom = async ({ vision, budget, inspoLink, inspoImage, details }) => {
    await db.submitInquiry({ type: "custom", vision, budget, inspoLink, inspoImage, details });
    go({ name: "home" });
    showToast("Custom design request sent! We can't wait to create it. ✨");
    setConfetti((c) => c + 1);
  };

  const cartCount = cart.reduce((n, it) => n + it.qty, 0);

  const NavLink = ({ label, target }) => (
    <button onClick={() => go(target)} className="text-sm px-1 py-1" style={{ letterSpacing: ".08em", color: view.name === target.name ? C.goldDeep : C.ink, borderBottom: view.name === target.name ? `1px solid ${C.gold}` : "1px solid transparent", background: "none", cursor: "pointer", borderTop: "none", borderLeft: "none", borderRight: "none" }}>{label}</button>
  );

  return (
    <div className="pnp-root min-h-screen flex flex-col">
      <header className="sticky top-0 z-30" style={{ background: `${C.porcelain}F0`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.line}` }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-6">
          <button onClick={() => go({ name: "home" })} className="flex items-baseline gap-2" style={{ background: "none", border: "none", cursor: "pointer" }}>
            <span className="f-display" style={{ fontSize: 30, fontStyle: "italic", color: C.ink, lineHeight: 1 }}>P&P</span>
            <span className="eyebrow hidden sm:inline" style={{ color: C.goldDeep }}>Posh & Polished</span>
          </button>
          <nav className="ml-auto flex items-center gap-4 sm:gap-6">
            <NavLink label="Home" target={{ name: "home" }} />
            <NavLink label="Collection" target={{ name: "catalog" }} />
            <NavLink label="Custom" target={{ name: "custom" }} />
            <button onClick={() => go({ name: "cart" })} className="relative px-4 py-2 rounded-full text-xs" style={{ background: C.ink, color: C.champagne, letterSpacing: ".12em", textTransform: "uppercase", border: "none", cursor: "pointer" }}>
              Inquiry list
              {cartCount > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[11px] flex items-center justify-center" style={{ background: C.gold, color: "#fff" }}>{cartCount}</span>}
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {!products ? (
          <div className="py-32 text-center f-display" style={{ fontSize: 26, color: C.goldDeep, fontStyle: "italic" }}>Setting the table…</div>
        ) : view.name === "home" ? (
          <>
            <Hero go={go} />
            <CategoryStrip products={products} go={go} />
            <section className="max-w-6xl mx-auto px-6 py-16">
              <div className="text-center mb-10">
                <div className="eyebrow" style={{ color: C.goldDeep }}>Client Favorites</div>
                <h2 className="f-display mt-2" style={{ fontSize: 36, fontWeight: 500 }}>Most-requested pieces</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                {products.filter((p) => p.available).slice(0, 6).map((p) => (
                  <ProductCard key={p.id} p={p} onOpen={setModalProduct} onAdd={addToCart} />
                ))}
              </div>
              <div className="text-center mt-12"><button className="btn-ghost" onClick={() => go({ name: "catalog" })}>View the full collection</button></div>
            </section>
            <section className="py-16" style={{ background: C.ink }}>
              <div className="max-w-3xl mx-auto px-6 text-center">
                <div className="eyebrow" style={{ color: C.gold }}>How it works</div>
                <h2 className="f-display mt-3" style={{ fontSize: 34, color: C.porcelain, fontWeight: 500 }}>Browse. Inquire. <em style={{ color: C.champagne }}>Celebrate.</em></h2>
                <p className="mt-4 font-light" style={{ color: "#CBB98F", lineHeight: 1.8 }}>
                  Add anything you love to your inquiry list, tell us about your event, and submit — no payment online, no pressure. We review every request personally and reply with a custom quote tailored to your date, guest count, and delivery needs.
                </p>
                <button className="btn-gold mt-8" onClick={() => go({ name: "catalog" })}>Start browsing</button>
              </div>
            </section>
          </>
        ) : view.name === "catalog" ? (
          <Catalog products={products} category={category} setCategory={setCategory} onOpen={setModalProduct} onAdd={addToCart} />
        ) : view.name === "custom" ? (
          <CustomDesign onSubmit={submitCustom} />
        ) : view.name === "cart" ? (
          <CartPage cart={cart} setCart={setCart} products={products} onSubmit={submitCart} />
        ) : view.name === "admin" ? (
          <Admin session={session} products={products} refreshProducts={refreshProducts} showToast={showToast} />
        ) : null}
      </main>

      <Footer go={go} />
      <ProductModal product={modalProduct} onClose={() => setModalProduct(null)} onAddToList={addToCart} onSubmitSingle={submitSingle} />
      <ConfettiBurst trigger={confetti} />
      <Toast toast={toast} />
    </div>
  );
}

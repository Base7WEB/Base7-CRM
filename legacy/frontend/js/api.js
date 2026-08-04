const API_BASE = "http://localhost:5000/api";

const Api = {
  async get(rota) {
    const r = await fetch(API_BASE + rota);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async post(rota, dados) {
    const r = await fetch(API_BASE + rota, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async put(rota, dados) {
    const r = await fetch(API_BASE + rota, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async del(rota) {
    const r = await fetch(API_BASE + rota, { method: "DELETE" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};

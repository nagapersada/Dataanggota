// app.js - MLM Dashboard v8 (UI fixed for scroll & zoom)

const firebaseConfig = {
  apiKey: "AIzaSyC4Ef9A9aHgYT_2OeecPWv_P-5kpRgYH1E",
  authDomain: "mlm-network-47720.firebaseapp.com",
  databaseURL: "https://mlm-network-47720-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mlm-network-47720",
  storageBucket: "mlm-network-47720.firebasestorage.app",
  messagingSenderId: "988431073923",
  appId: "1:988431073923:web:23a0c98c300e2b2058d1b6"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

const loginSection = document.getElementById("loginSection");
const mainSection = document.getElementById("mainSection");
const logoutBtn = document.getElementById("logoutBtn");
const loginBtn = document.getElementById("loginBtn");

const q = id => document.getElementById(id);
let members = [];

loginBtn.onclick = async () => {
  const email = q("loginEmail").value.trim();
  const pw = q("loginPassword").value.trim();
  if (!email || !pw) return alert("Isi email dan password!");
  try {
    await auth.signInWithEmailAndPassword(email, pw);
  } catch (e) { alert("Login gagal: " + e.message); }
};

logoutBtn.onclick = async () => { await auth.signOut(); };

auth.onAuthStateChanged(user => {
  if (user) {
    loginSection.style.display = "none";
    mainSection.style.display = "block";
    logoutBtn.style.display = "inline-block";
    loadMembers();
  } else {
    mainSection.style.display = "none";
    loginSection.style.display = "block";
    logoutBtn.style.display = "none";
  }
});

function loadMembers() {
  db.ref("members").on("value", snap => {
    const data = snap.val() || {};
    members = Object.keys(data).map(id => ({ id, ...data[id] }));
    renderMembers();
    renderGrowth();
    renderNetwork();
  });
}

q("memberForm").onsubmit = e => {
  e.preventDefault();
  const id = q("editId").value;
  const data = {
    nama: q("nama").value.trim(),
    uid: q("uid").value.trim(),
    referralNama: q("referralNama").value.trim(),
    referralUid: q("referralUid").value.trim(),
    tglGabung: q("tglGabung").value
  };
  if (!data.nama || !data.uid) return alert("Nama dan UID wajib!");
  if (id) db.ref("members/" + id).set(data);
  else db.ref("members").push(data);
  e.target.reset();
  q("editId").value = "";
};

function renderMembers() {
  const list = q("memberList");
  list.innerHTML = "";
  members.forEach(m => {
    const div = document.createElement("div");
    div.style = "background:#1e293b;margin:6px 0;padding:10px;border-radius:6px;";
    div.innerHTML = `
      <b>${m.nama}</b> (${m.uid})<br>
      Referral: ${m.referralNama || "-"} (${m.referralUid || "-"})<br>
      Tgl: ${m.tglGabung || "-"}<br>
      <button onclick="editMember('${m.id}')">✏️</button>
      <button onclick="deleteMember('${m.id}')">🗑️</button>
    `;
    list.appendChild(div);
  });
}

function editMember(id) {
  const m = members.find(x => x.id === id);
  if (!m) return;
  q("editId").value = m.id;
  q("nama").value = m.nama;
  q("uid").value = m.uid;
  q("referralNama").value = m.referralNama;
  q("referralUid").value = m.referralUid;
  q("tglGabung").value = m.tglGabung;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteMember(id) {
  if (confirm("Hapus anggota ini?")) db.ref("members/" + id).remove();
}

// ----------------- Growth Chart -----------------
let chart;
function renderGrowth() {
  const ctx = q("growthChart").getContext("2d");
  if (chart) chart.destroy();
  const dates = members.map(m => new Date(m.tglGabung));
  if (!dates.length) return;
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  const labels = [], values = [];
  for (let d = new Date(min); d <= max; d.setDate(d.getDate() + 15)) {
    const end = new Date(d); end.setDate(end.getDate() + 15);
    const c = members.filter(m => {
      const t = new Date(m.tglGabung);
      return t >= d && t < end;
    }).length;
    labels.push(d.toISOString().slice(0,10));
    values.push(c);
  }
  chart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data: values, backgroundColor: "#2563eb" }] },
    options: { plugins:{legend:{display:false}}, scales:{x:{ticks:{color:"#9ca3af"}},y:{ticks:{color:"#9ca3af"}}} }
  });
}

// ----------------- Network Tree -----------------
function renderNetwork() {
  const svg = d3.select("#networkGraph");
  svg.selectAll("*").remove();
  const width = q("networkContainer").clientWidth;
  const height = 500;
  svg.attr("width", width).attr("height", height);

  const uidMap = {};
  members.forEach(m => uidMap[m.uid] = { ...m, children: [] });
  const roots = [];
  members.forEach(m => {
    if (m.referralUid && uidMap[m.referralUid])
      uidMap[m.referralUid].children.push(uidMap[m.uid]);
    else roots.push(uidMap[m.uid]);
  });
  const treeData = { nama: "ROOT", children: roots };

  const root = d3.hierarchy(treeData);
  const treeLayout = d3.tree().nodeSize([60, 160]);
  treeLayout(root);

  const g = svg.append("g");
  const link = d3.linkHorizontal().x(d => d.y).y(d => d.x);

  g.selectAll(".link")
    .data(root.links())
    .enter().append("path")
    .attr("class","link")
    .attr("d", link);

  const node = g.selectAll(".node")
    .data(root.descendants())
    .enter().append("g")
    .attr("class","node")
    .attr("transform", d => `translate(${d.y},${d.x})`)
    .on("click", (_, d) => { toggle(d); update(); });

  node.append("circle")
    .attr("r", 18)
    .attr("fill", d => d._children ? "#1d4ed8" : "#2563eb");

  node.append("text")
    .attr("x", 26)
    .attr("y", 4)
    .text(d => d.data.nama)
    .attr("fill","#e6eefc");

  const panzoom = Panzoom(svg.node(), { contain:'outside', maxScale:2.5, minScale:0.5 });
  svg.node().parentElement.addEventListener('wheel', panzoom.zoomWithWheel);

  const container = document.getElementById("networkContainer");
  let isDown = false, startX, startY, scrollLeft, scrollTop;
  container.addEventListener('mousedown', e => {
    isDown = true;
    startX = e.pageX - container.offsetLeft;
    startY = e.pageY - container.offsetTop;
    scrollLeft = container.scrollLeft;
    scrollTop = container.scrollTop;
  });
  container.addEventListener('mouseleave', () => isDown = false);
  container.addEventListener('mouseup', () => isDown = false);
  container.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    container.scrollLeft = scrollLeft - (x - startX);
    container.scrollTop = scrollTop - (y - startY);
  });

  function toggle(d) {
    if (d.children) { d._children = d.children; d.children = null; }
    else { d.children = d._children; d._children = null; }
  }
  function update() {
    g.selectAll("*").remove();
    treeLayout(root);
    g.selectAll(".link")
      .data(root.links())
      .enter().append("path")
      .attr("class","link")
      .attr("d", link);
    const n = g.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class","node")
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .on("click", (_, d) => { toggle(d); update(); });
    n.append("circle").attr("r", 18).attr("fill", d => d._children ? "#1d4ed8" : "#2563eb");
    n.append("text").attr("x", 26).attr("y", 4).text(d => d.data.nama).attr("fill","#e6eefc");
  }
}

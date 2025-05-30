function normalizeScoreInput(str) {
  if (!str) return "";
  return str
    .replace(/[−ー―]/g, "-")
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 65248))
    .replace(/[^0-9.\-]/g, "")
    .replace(/(?!^)-/g, "");
}
const STORAGE_KEY = "mahjongScoreRecordsV3";
const PLAYER_NAMES_SET_KEY = "mahjongPlayerNamesPopupV1";
const PLAYER_NAMES_KEY = "mahjongPlayerNamesV4";

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveRecords(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadNameSet() {
  try {
    const raw = localStorage.getItem(PLAYER_NAMES_SET_KEY);
    return raw ? JSON.parse(raw) : ["A", "B", "C", "D"];
  } catch {
    return ["A", "B", "C", "D"];
  }
}
function saveNameSet(nameSet) {
  localStorage.setItem(PLAYER_NAMES_SET_KEY, JSON.stringify(nameSet));
}
function loadNames() {
  try {
    const raw = localStorage.getItem(PLAYER_NAMES_KEY);
    return raw ? JSON.parse(raw) : ["A", "B", "C", "D"];
  } catch {
    return ["A", "B", "C", "D"];
  }
}
function saveNames(names) {
  localStorage.setItem(PLAYER_NAMES_KEY, JSON.stringify(names));
}

document.addEventListener("DOMContentLoaded", () => {
  // 名前UI
  const playerNameWraps = [
    document.querySelector('.player-name-popup-wrap[data-index="0"]'),
    document.querySelector('.player-name-popup-wrap[data-index="1"]'),
    document.querySelector('.player-name-popup-wrap[data-index="2"]'),
    document.querySelector('.player-name-popup-wrap[data-index="3"]')
  ];
  const playerNameInputs = [
    document.getElementById("playerName0"),
    document.getElementById("playerName1"),
    document.getElementById("playerName2"),
    document.getElementById("playerName3")
  ];
  const namePopupDivs = [
    document.getElementById("namePopup0"),
    document.getElementById("namePopup1"),
    document.getElementById("namePopup2"),
    document.getElementById("namePopup3")
  ];
  const scoreRowsDiv = document.getElementById("scoreRows");
  const addScoreRowBtn = document.getElementById("addScoreRowBtn");
  const calcBtn = document.getElementById("calcBtn");
  const registerBtn = document.getElementById("registerBtn");
  const totalScoresDisplay = document.getElementById("totalScoresDisplay");
  const gameDateInput = document.getElementById("gameDate");
  const scoreForm = document.getElementById("scoreForm");
  const resultsTableBody = document.getElementById("resultsTableBody");
  const scoreChartCanvas = document.getElementById("scoreChart");
  const statsTableContainer = document.getElementById("statsTableContainer");
  let chart = null;

  // ======= 名前ポップアップUI =======
  function renderNamePopup(idx, filterVal = "") {
    const nameSet = Array.from(new Set(loadNameSet().filter(Boolean)));
    const inputVal = playerNameInputs[idx].value.trim();
    let filtered = nameSet;
    if (filterVal) {
      const val = filterVal.toLowerCase();
      filtered = nameSet.filter(n => n.toLowerCase().includes(val));
    }
    let html = "";
    filtered.forEach(n => {
      html += `<div class="name-popup-item${inputVal===n ? " selected":""}" data-name="${n}">${n}</div>`;
    });
    if (filtered.length === 0) {
      html += `<div class="name-popup-item" style="color:#aaa;">（保存名なし）</div>`;
    }
    if (inputVal && nameSet.includes(inputVal)) {
      html += `<div class="name-popup-item del-btn" data-del="1">この名前を保存リストから削除</div>`;
    }
    namePopupDivs[idx].innerHTML = html;

    // イベント
    namePopupDivs[idx].querySelectorAll(".name-popup-item[data-name]").forEach(item => {
      item.onclick = (e) => {
        playerNameInputs[idx].value = item.dataset.name;
        savePlayerNamesFromForm();
        closeAllPopups();
      };
    });
    namePopupDivs[idx].querySelectorAll(".name-popup-item.del-btn").forEach(item => {
      item.onclick = () => {
        let set = loadNameSet();
        set = set.filter(n => n !== inputVal);
        saveNameSet(set);
        renderNamePopup(idx, "");
      };
    });
  }
  function openPopup(idx) {
    renderNamePopup(idx, playerNameInputs[idx].value.trim());
    namePopupDivs[idx].classList.add("active");
    // スクロールで消える
    setTimeout(() => {
      document.addEventListener("click", outsidePopupHandler, { once: true });
    }, 0);
  }
  function closeAllPopups() {
    namePopupDivs.forEach(div => div.classList.remove("active"));
  }
  function outsidePopupHandler(e) {
    if (![...playerNameWraps, ...namePopupDivs].some(w => w.contains(e.target))) {
      closeAllPopups();
    }
  }
  playerNameInputs.forEach((input, idx) => {
    input.addEventListener("focus", () => {
      openPopup(idx);
    });
    input.addEventListener("input", () => {
      savePlayerNamesFromForm();
      renderNamePopup(idx, input.value.trim());
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        // キーボードで選択も実装可（省略）
        e.preventDefault();
      } else if (e.key === "Escape") {
        closeAllPopups();
      }
    });
  });

  // ======= 名前保存・復元 =======
  function addNameToSet(newName) {
    let nameSet = loadNameSet();
    if (!nameSet.includes(newName) && newName) {
      nameSet.push(newName);
      saveNameSet(nameSet);
    }
  }
  function savePlayerNamesFromForm() {
    const names = playerNameInputs.map(input => input.value.trim() || `P${playerNameInputs.indexOf(input) + 1}`);
    saveNames(names);
    names.forEach(addNameToSet);
  }
  function loadPlayerNamesToForm() {
    const saved = loadNames();
    playerNameInputs.forEach((input, i) => {
      input.value = saved[i] || "";
    });
    namePopupDivs.forEach((div, idx) => {
      renderNamePopup(idx, playerNameInputs[idx].value.trim());
    });
  }

  // ========== 得点入力行 ==========
  function createScoreRow(values = ["", "", "", ""]) {
    const row = document.createElement("div");
    row.className = "score-row-card";
    row.innerHTML = `
      <input type="text" class="input-box score-input" placeholder="得点" inputmode="decimal" pattern=".*" autocomplete="off" value="${values[0]}">
      <input type="text" class="input-box score-input" placeholder="得点" inputmode="decimal" pattern=".*" autocomplete="off" value="${values[1]}">
      <input type="text" class="input-box score-input" placeholder="得点" inputmode="decimal" pattern=".*" autocomplete="off" value="${values[2]}">
      <input type="text" class="input-box score-input" placeholder="得点" inputmode="decimal" pattern=".*" autocomplete="off" value="${values[3]}">
      <button type="button" class="delete-btn">削除</button>
    `;
    row.querySelector(".delete-btn").onclick = () => row.remove();
    return row;
  }
  function resetScoreRows() {
    scoreRowsDiv.innerHTML = "";
    scoreRowsDiv.appendChild(createScoreRow());
  }
  gameDateInput.value = new Date().toISOString().slice(0, 10);
  resetScoreRows();

  addScoreRowBtn.addEventListener("click", () => {
    scoreRowsDiv.appendChild(createScoreRow());
  });

  // ========== 合計・順位計算 ==========
  function calcTotals() {
    const scoreRows = scoreRowsDiv.querySelectorAll(".score-row-card");
    const totalScores = [0, 0, 0, 0];
    scoreRows.forEach(row => {
      const inputs = row.querySelectorAll(".score-input");
      inputs.forEach((input, i) => {
        const val = normalizeScoreInput(input.value.trim());
        if (val !== "" && !isNaN(Number(val))) {
          totalScores[i] += parseFloat(val);
        }
      });
    });
    const scoreWithIndex = totalScores.map((score, i) => ({ index: i, score }));
    scoreWithIndex.sort((a, b) => b.score - a.score);
    const ranks = [];
    let currentRank = 1;
    for (let i = 0; i < scoreWithIndex.length; i++) {
      if (i > 0 && scoreWithIndex[i].score < scoreWithIndex[i - 1].score) {
        currentRank = i + 1;
      }
      ranks[scoreWithIndex[i].index] = currentRank;
    }
    totalScoresDisplay.innerHTML = "";
    const label = document.createElement("div");
    label.className = "total-score-label";
    label.textContent = "合計得点";
    totalScoresDisplay.appendChild(label);
    for (let i = 0; i < 4; i++) {
      const td = document.createElement("div");
      td.className = "total-score-cell";
      td.textContent = totalScores[i].toFixed(2);
      totalScoresDisplay.appendChild(td);
    }
    const rankDiv = document.createElement("div");
    rankDiv.className = "total-score-cell";
    rankDiv.textContent = "順位: " + ranks.join(" / ");
    totalScoresDisplay.appendChild(rankDiv);

    return { totalScores, ranks };
  }
  calcBtn.addEventListener("click", calcTotals);

  // ========== フォーム送信 ==========
  scoreForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const { totalScores, ranks } = calcTotals();
    const names = playerNameInputs.map(input => input.value.trim() || `P${playerNameInputs.indexOf(input) + 1}`);
    saveNames(names);
    names.forEach(addNameToSet);
    const date = gameDateInput.value || new Date().toISOString().slice(0, 10);
    const records = loadRecords();
    const nextNo = Math.floor(records.length / 4) + 1;
    for (let i = 0; i < 4; i++) {
      records.push({
        date: date,
        player: names[i],
        score: totalScores[i],
        rank: ranks[i],
        no: nextNo
      });
    }
    saveRecords(records);
    updateResultsTable();
    updateGraph();
    updateStatsTable();
    resetScoreRows();
  });

  // ========== 成績履歴 ==========
  function updateResultsTable() {
    const records = loadRecords();
    resultsTableBody.innerHTML = "";
    if (!records.length) return;
    const last4 = records.slice(-4);
    const no = last4.length ? last4[0].no : "";
    last4.forEach((rec, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${no}</td>
        <td>${rec.date}</td>
        <td>${rec.player}</td>
        <td>${Number(rec.score).toFixed(2)}</td>
        <td>${rec.rank}</td>
        <td><button type="button" class="delete-btn" data-idx="${records.length-4+idx}">削除</button></td>
      `;
      resultsTableBody.appendChild(tr);
    });
    resultsTableBody.querySelectorAll("button.delete-btn").forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        const recs = loadRecords();
        recs.splice(idx, 1);
        saveRecords(recs);
        updateResultsTable();
        updateGraph();
        updateStatsTable();
      };
    });
  }

  // ========== グラフ ==========
  function updateGraph() {
    const records = loadRecords();
    if (!records.length) {
      if (chart) {
        chart.destroy();
        chart = null;
      }
      return;
    }
    const playerSet = Array.from(new Set(records.map(r => r.player)));
    const gameCount = Math.floor(records.length / 4);
    let games = [];
    for (let i = 0; i < gameCount; i++) {
      games.push(records.slice(i*4, i*4+4));
    }
    const cumulative = {};
    playerSet.forEach(p => cumulative[p] = []);
    const sum = {};
    playerSet.forEach(p => sum[p] = 0);
    games.forEach((game, idx) => {
      game.forEach(result => {
        sum[result.player] += Number(result.score);
      });
      playerSet.forEach(p => cumulative[p].push(sum[p]));
    });
    const labels = games.map((g, i) => `#${i+1}`);
    const colors = ["#f87171","#60a5fa","#34d399","#a78bfa","#fbbf24","#f472b6","#38bdf8","#c084fc"];
    const datasets = playerSet.map((p, i) => ({
      label: p,
      data: cumulative[p],
      borderWidth: 3,
      fill: false,
      tension: 0.24,
      pointRadius: 5,
      borderColor: colors[i%colors.length],
      backgroundColor: colors[i%colors.length],
      pointBackgroundColor: colors[i%colors.length],
      pointBorderColor: "#fff",
    }));
    if (chart) chart.destroy();
    chart = new Chart(scoreChartCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { mode: 'nearest', intersect: false },
        },
        scales: {
          x: { title: { display: true, text: '対局数' }, ticks: { autoSkip: false } },
          y: { title: { display: true, text: '累積得点' }, beginAtZero: false },
        },
        elements: {
          line: { borderJoinStyle: 'round' },
          point: { radius: 5, hoverRadius: 7 },
        },
      },
    });
  }

  // ========== 成績詳細集計 ==========
  function analyzePlayers(records) {
    const players = {};
    records.forEach(r => {
      if (!players[r.player]) {
        players[r.player] = {
          name: r.player,
          totalScore: 0,
          games: 0,
          sumRank: 0,
          rankList: [],
          win1: 0,
          win2: 0,
          win3: 0,
          win4: 0,
        };
      }
      const p = players[r.player];
      p.totalScore += Number(r.score);
      p.games += 1;
      p.sumRank += Number(r.rank);
      p.rankList.push(Number(r.rank));
      if (r.rank === 1) p.win1 += 1;
      if (r.rank === 2) p.win2 += 1;
      if (r.rank === 3) p.win3 += 1;
      if (r.rank === 4) p.win4 += 1;
    });
    for (const name in players) {
      const p = players[name];
      if (p.games === 0) continue;
      p.avgScore = p.totalScore / p.games;
      p.avgRank = p.sumRank / p.games;
      p.topRate = p.win1 / p.games;
      p.lastRate = p.win4 / p.games;
      p.top2Rate = (p.win1 + p.win2) / p.games;
      p.earning = Math.round(p.totalScore * 0.3);
      const n = p.rankList.length;
      const mean = p.avgRank;
      const varSum = p.rankList.map(x => (x-mean)**2).reduce((a,b) => a+b,0);
      const se = n > 1 ? Math.sqrt(varSum/(n-1)) / Math.sqrt(n) : 0;
      p.ci95low = mean - 1.96*se;
      p.ci95up  = mean + 1.96*se;
    }
    return players;
  }
  function renderStatsTable(players) {
    const metrics = [
      { label: "平均順位", key: "avgRank", fmt: v => v?.toFixed(2) },
      { label: "平均スコア", key: "avgScore", fmt: v => v ? (v>0?`+${v.toFixed(2)}`:v.toFixed(2)) : "0" },
      { label: "合計スコア", key: "totalScore", fmt: v => v ? (v>0?`+${v.toFixed(2)}`:v.toFixed(2)) : "0" },
      { label: "収支", key: "earning", fmt: v => v ? (v>0?`+￥${v.toLocaleString()}`:`￥${v.toLocaleString()}`) : "￥0", style: v=>v<0?"red":v>0?"green":"" },
      { label: "1位回数", key: "win1" }, { label: "2位回数", key: "win2" }, { label: "3位回数", key: "win3" }, { label: "4位回数", key: "win4" },
      { label: "試合数", key: "games" },
      { label: "トップ率", key: "topRate", fmt: v => v!==undefined ? (v*100).toFixed(2)+"%" : "-" },
      { label: "ラス率", key: "lastRate", fmt: v => v!==undefined ? (v*100).toFixed(2)+"%" : "-" },
      { label: "連対率", key: "top2Rate", fmt: v => v!==undefined ? (v*100).toFixed(2)+"%" : "-" },
      { label: "平均順位95%信頼区間（上限）", key: "ci95up", fmt: v => v!==undefined ? v.toFixed(2) : "-" },
      { label: "平均順位95%信頼区間（下限）", key: "ci95low", fmt: v => v!==undefined ? v.toFixed(2) : "-" },
    ];
    const names = Object.keys(players);
    if (!names.length) {
      statsTableContainer.innerHTML = "<p>成績データがありません。</p>";
      return;
    }
    let html = `<table class="stats-table"><thead><tr><th></th>` +
               names.map(n=>`<th>${n}</th>`).join("") + `</tr></thead><tbody>`;
    metrics.forEach(m => {
      html += `<tr><td>${m.label}</td>` +
        names.map(n => {
          const val = players[n][m.key];
          const style = m.style ? m.style(val) : "";
          return `<td${style ? ` class="${style}"` : ""}>${m.fmt ? m.fmt(val) : val ?? "-"}</td>`;
        }).join("") + `</tr>`;
    });
    html += `</tbody></table>`;
    statsTableContainer.innerHTML = html;
  }
  function updateStatsTable() {
    const records = loadRecords();
    const players = analyzePlayers(records);
    renderStatsTable(players);
  }

  // 初期描画
  loadPlayerNamesToForm();
  updateResultsTable();
  updateGraph();
  updateStatsTable();
});
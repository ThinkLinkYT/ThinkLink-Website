const WRAPPED_API_URL = "";
const RANGE_ORDER = ["7d", "30d", "90d", "365d", "all"];
const RANGE_LABELS = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "365d": "365 days",
  all: "All time"
};

const state = {
  payload: null,
  activeRange: "all"
};

const els = {
  avatar: document.querySelector("#wrapped-avatar"),
  heading: document.querySelector("#wrapped-heading"),
  subtitle: document.querySelector("#wrapped-subtitle"),
  generated: document.querySelector("#wrapped-generated"),
  id: document.querySelector("#wrapped-id"),
  tabs: document.querySelector("#wrapped-range-tabs"),
  note: document.querySelector("#wrapped-range-note"),
  statGrid: document.querySelector("#wrapped-stat-grid"),
  economyMain: document.querySelector("#wrapped-economy-main"),
  inventory: document.querySelector("#wrapped-inventory"),
  topChannels: document.querySelector("#wrapped-top-channels"),
  topEmojis: document.querySelector("#wrapped-top-emojis"),
  topMentions: document.querySelector("#wrapped-top-mentions"),
  achievements: document.querySelector("#wrapped-achievements"),
  copyLink: document.querySelector("#copy-wrapped-link"),
  error: document.querySelector("#wrapped-error"),
  errorMessage: document.querySelector("#wrapped-error-message")
};

initWrappedPage();

async function initWrappedPage() {
  setupCopyLink();

  try {
    const payload = await loadWrappedPayload();
    if (!payload) {
      showError("This page needs a Wrapped payload or a valid unique Wrapped ID.");
      return;
    }

    state.payload = payload;
    state.activeRange = getInitialRange(payload);
    renderWrapped(payload);
  } catch (error) {
    console.warn(error);
    showError(error.message || "The Wrapped link could not be loaded.");
  }
}

function getParams() {
  return new URLSearchParams(window.location.search);
}

async function loadWrappedPayload() {
  const params = getParams();

  if (params.get("setup") === "api-required") {
    throw new Error("The bot is ready, but WRAPPED_API_URL still needs to be configured so Discord can open short unique Wrapped links.");
  }

  if (params.has("d")) {
    return decodeInlinePayload(params.get("d"), params.get("z") === "1");
  }

  const id = params.get("id");
  if (!id) return null;

  const apiUrl = params.get("api") || WRAPPED_API_URL;
  if (!apiUrl) {
    throw new Error("This Wrapped ID needs the public Apps Script API URL in the link or in assets/js/wrapped.js.");
  }

  const response = await loadWrappedJsonp(apiUrl, id);
  if (!response?.ok || !response?.payload) {
    throw new Error(response?.error || "The Wrapped API did not return stats for this ID.");
  }
  return response.payload;
}

async function decodeInlinePayload(value, compressed) {
  const bytes = base64UrlToBytes(value);
  if (!compressed) {
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  if (!("DecompressionStream" in window)) {
    throw new Error("This browser cannot decompress inline Wrapped links. Use the Apps Script unique ID link instead.");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function loadWrappedJsonp(apiUrl, id) {
  return new Promise((resolve, reject) => {
    const callbackName = `thinklinkWrapped_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(apiUrl);
    url.searchParams.set("id", id);
    url.searchParams.set("callback", callbackName);

    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("The Wrapped API took too long to respond."));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Could not load the Wrapped API script."));
    };

    script.src = url.toString();
    document.head.appendChild(script);
  });
}

function getInitialRange(payload) {
  const requested = getParams().get("range");
  if (requested && payload.ranges?.[requested]) return requested;
  return payload.ranges?.all ? "all" : Object.keys(payload.ranges || {})[0] || "all";
}

function renderWrapped(payload) {
  const user = payload.user || {};
  document.title = `${user.displayName || user.username || "ThinkLink"} Wrapped`;

  if (els.avatar && user.avatar) {
    els.avatar.src = user.avatar;
    els.avatar.alt = `${user.displayName || user.username || "User"} avatar`;
  }
  if (els.heading) els.heading.textContent = `${user.displayName || user.username || "Your"} Wrapped`;
  if (els.subtitle) {
    els.subtitle.textContent = `${payload.guild?.name || "ThinkLink's Land"} activity, economy, and community stats.`;
  }
  if (els.generated) els.generated.textContent = formatDate(payload.generatedAt);
  if (els.id) els.id.textContent = `ID ${payload.id || "inline"}`;

  renderRangeTabs(payload);
  renderRange(payload, state.activeRange);
  renderEconomy(payload.economy || {});
  renderAchievements(payload.achievements || []);
}

function renderRangeTabs(payload) {
  if (!els.tabs) return;
  els.tabs.replaceChildren();

  RANGE_ORDER.filter(key => payload.ranges?.[key]).forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wrapped-range-tab";
    button.textContent = RANGE_LABELS[key] || payload.ranges[key].label || key;
    button.dataset.range = key;
    button.setAttribute("aria-pressed", String(key === state.activeRange));
    button.addEventListener("click", () => {
      state.activeRange = key;
      updateRangeUrl(key);
      renderRange(payload, key);
    });
    els.tabs.append(button);
  });
}

function updateRangeUrl(range) {
  const url = new URL(window.location.href);
  url.searchParams.set("range", range);
  window.history.replaceState({}, "", url);
}

function renderRange(payload, rangeKey) {
  const range = payload.ranges?.[rangeKey] || payload.ranges?.all;
  if (!range) return;

  document.querySelectorAll(".wrapped-range-tab").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.range === rangeKey));
  });

  if (els.note) els.note.textContent = range.note || "";

  const stats = range.stats || {};
  const economy = payload.economy || {};
  renderStatGrid([
    ["Messages", stats.messages, "Community chatter"],
    ["Counting", stats.countingPoints, "Correct counting points"],
    ["Tickets", stats.tickets, "Tickets opened"],
    ["Giveaways", stats.giveaways, "Entries made"],
    ["Wins", stats.giveawaysWon, "Giveaways won"],
    ["Voice", formatDuration(stats.vcTime), "Time in voice"],
    ["Magic 8", stats.magic8, "Questions asked"],
    ["Net Worth", formatCoins(economy.total), "Wallet plus bank"],
    ["Fish", economy.stats?.fishCaught || 0, "Fish caught"],
    ["Ores", economy.stats?.oresMined || 0, "Ores mined"],
    ["Wood", economy.stats?.woodChopped || 0, "Wood chopped"],
    ["Crops", economy.stats?.farming || 0, "Crops farmed"]
  ]);

  renderTopList(els.topChannels, range.top?.channels, "No channel data yet.");
  renderTopList(els.topEmojis, range.top?.emojis, "No emoji data yet.");
  renderTopList(els.topMentions, range.top?.mentions, "No mention data yet.");
}

function renderStatGrid(items) {
  if (!els.statGrid) return;
  els.statGrid.replaceChildren();
  items.forEach(([label, value, detail]) => {
    const article = document.createElement("article");
    article.className = "wrapped-stat-card";
    article.innerHTML = `
      <span class="wrapped-stat-card__value">${escapeHtml(String(formatStatValue(value)))}</span>
      <span class="wrapped-stat-card__label">${escapeHtml(label)}</span>
      <span class="wrapped-stat-card__detail">${escapeHtml(detail)}</span>
    `;
    els.statGrid.append(article);
  });
}

function renderEconomy(economy) {
  if (els.economyMain) {
    els.economyMain.replaceChildren(
      makeEconomyTile("Wallet", formatCoins(economy.wallet)),
      makeEconomyTile("Bank", formatCoins(economy.bank)),
      makeEconomyTile("Job", economy.job?.name || "Unemployed"),
      makeEconomyTile("Job Streak", `${economy.job?.streak || 0} days`),
      makeEconomyTile("House", economy.house || "No house yet"),
      makeEconomyTile("Rod", economy.fishing?.rod || "Basic Rod"),
      makeEconomyTile("Pets", `${economy.pets?.owned?.length || 0} owned`),
      makeEconomyTile("Quests", `${economy.stats?.questsCompleted || 0} completed`)
    );
  }

  if (els.inventory) {
    const items = [
      ...(economy.inventory || []).map(item => ({ ...item, group: "Item" })),
      ...(economy.fishing?.inventory || []).map(item => ({ ...item, group: "Fish" }))
    ].slice(0, 10);
    renderInventory(items);
  }
}

function makeEconomyTile(label, value) {
  const article = document.createElement("article");
  article.className = "wrapped-economy-tile";
  article.innerHTML = `
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(String(value))}</strong>
  `;
  return article;
}

function renderInventory(items) {
  els.inventory.replaceChildren();
  if (!items.length) {
    els.inventory.append(makeEmptyLine("No inventory highlights yet."));
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "wrapped-list-row";
    row.innerHTML = `
      <span>${escapeHtml(item.name)}</span>
      <strong>${escapeHtml(formatNumber(item.qty))}</strong>
    `;
    els.inventory.append(row);
  });
}

function renderTopList(container, entries = [], emptyText) {
  if (!container) return;
  container.replaceChildren();

  if (!entries.length) {
    container.append(makeEmptyLine(emptyText));
    return;
  }

  entries.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "wrapped-list-row";
    row.innerHTML = `
      <span>${index + 1}. ${escapeHtml(entry.label || entry.id)}</span>
      <strong>${escapeHtml(formatNumber(entry.count))}</strong>
    `;
    container.append(row);
  });
}

function renderAchievements(items) {
  if (!els.achievements) return;
  els.achievements.replaceChildren();
  items.forEach((item) => {
    const badge = document.createElement("span");
    badge.className = "wrapped-achievement";
    badge.textContent = item;
    els.achievements.append(badge);
  });
}

function makeEmptyLine(text) {
  const empty = document.createElement("p");
  empty.className = "wrapped-empty";
  empty.textContent = text;
  return empty;
}

function setupCopyLink() {
  if (!els.copyLink) return;
  els.copyLink.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      els.copyLink.firstChild.textContent = "Copied ";
      window.setTimeout(() => {
        els.copyLink.firstChild.textContent = "Copy Link ";
      }, 1600);
    } catch {
      els.copyLink.firstChild.textContent = "Copy failed ";
    }
  });
}

function showError(message) {
  if (els.error) els.error.hidden = false;
  if (els.errorMessage) els.errorMessage.textContent = message;
  if (els.subtitle) els.subtitle.textContent = "The Wrapped page could not load this link.";
}

function formatStatValue(value) {
  if (typeof value === "number") return formatNumber(value);
  return value;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatCoins(value) {
  return `${formatNumber(value)} coins`;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(Number(ms || 0) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${totalSeconds}s`;
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

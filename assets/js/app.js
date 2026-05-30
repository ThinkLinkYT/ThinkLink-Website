const DATA_URL = "data/channel.json";
const FALLBACK = {
  channel: {
    id: "UCKoSe3mZp5VI5psWORRbObA",
    title: "ThinkLink",
    handle: "@ThinkLink_YT",
    url: "https://www.youtube.com/@ThinkLink_YT/featured",
    description:
      "I play Modded Minecraft with my friends, host Minecraft events, and spend a ton of time editing.",
    subscriberCount: null,
    viewCount: null,
    videoCount: 0,
    memberCount: null,
    membershipsAvailable: false
  },
  latestVideo: null,
  videos: [],
  playlists: [],
  updatedAt: null
};

const els = {
  siteHeader: document.querySelector(".site-header"),
  navToggle: document.querySelector(".nav-toggle"),
  navLinks: document.querySelector(".nav-links"),
  spotlightImage: document.querySelector("#spotlight-image"),
  spotlightPlay: document.querySelector("#spotlight-play"),
  spotlightStatus: document.querySelector("#spotlight-status"),
  spotlightHeading: document.querySelector("#spotlight-heading"),
  spotlightMeta: document.querySelector("#spotlight-meta"),
  spotlightDescription: document.querySelector("#spotlight-description"),
  watchLink: document.querySelector("#watch-link"),
  aboutText: document.querySelector("#about-text"),
  subscriberCount: document.querySelector("#subscriber-count"),
  videoCount: document.querySelector("#video-count"),
  viewCount: document.querySelector("#view-count"),
  memberCount: document.querySelector("#member-count"),
  lastUpdated: document.querySelector("#last-updated"),
  milestoneGrid: document.querySelector("#milestone-grid"),
  seriesGrid: document.querySelector("#series-grid"),
  seriesCount: document.querySelector("#series-count"),
  seriesUpdated: document.querySelector("#series-updated"),
  videoGrid: document.querySelector("#video-grid"),
  videosCount: document.querySelector("#videos-count"),
  videosUpdated: document.querySelector("#videos-updated")
};

init();

async function init() {
  setupMobileNav();
  setupCopyButtons();
  const data = await loadChannelData();
  render(data);
}

function setupMobileNav() {
  if (!els.siteHeader || !els.navToggle || !els.navLinks) {
    return;
  }

  const desktopQuery = window.matchMedia("(min-width: 981px)");

  const setOpen = (isOpen) => {
    els.siteHeader.classList.toggle("is-nav-open", isOpen);
    els.navToggle.setAttribute("aria-expanded", String(isOpen));
    els.navToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  };

  els.navToggle.addEventListener("click", () => {
    setOpen(!els.siteHeader.classList.contains("is-nav-open"));
  });

  els.navLinks.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setOpen(false);
    }
  });

  const closeOnDesktop = (event) => {
    if (event.matches) {
      setOpen(false);
    }
  };

  if (typeof desktopQuery.addEventListener === "function") {
    desktopQuery.addEventListener("change", closeOnDesktop);
  } else {
    desktopQuery.addListener(closeOnDesktop);
  }
}

function setupCopyButtons() {
  document.querySelectorAll("[data-copy-code]").forEach((button) => {
    const code = button.getAttribute("data-copy-code") || "";
    const defaultText = button.textContent;

    button.addEventListener("click", async () => {
      if (!code) {
        return;
      }

      try {
        await navigator.clipboard.writeText(code);
        button.textContent = "Copied";
        button.classList.add("is-copied");
      } catch (error) {
        console.warn(error);
        button.textContent = code;
      }

      window.setTimeout(() => {
        button.textContent = defaultText;
        button.classList.remove("is-copied");
      }, 1800);
    });
  });
}

async function loadChannelData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load ${DATA_URL}`);
    }
    return mergeData(FALLBACK, await response.json());
  } catch (error) {
    console.warn(error);
    return FALLBACK;
  }
}

function mergeData(base, incoming) {
  return {
    ...base,
    ...incoming,
    channel: {
      ...base.channel,
      ...(incoming.channel || {})
    },
    videos: Array.isArray(incoming.videos) ? incoming.videos : base.videos,
    playlists: Array.isArray(incoming.playlists) ? incoming.playlists : base.playlists
  };
}

function render(data) {
  const { channel, latestVideo, videos, playlists } = data;
  const ownerVideos = Array.isArray(videos) ? videos.filter(isDisplayableOwnerVideo) : [];
  const ownerLatestVideo = isDisplayableOwnerVideo(latestVideo) ? latestVideo : ownerVideos[0] || null;

  document.title = document.title.replace("ThinkLink", channel.title || "ThinkLink");

  if (els.aboutText) {
    els.aboutText.textContent = channel.description || FALLBACK.channel.description;
  }

  if (els.watchLink) {
    els.watchLink.href = ownerLatestVideo?.url || channel.url || FALLBACK.channel.url;
  }

  if (els.lastUpdated) {
    els.lastUpdated.textContent = formatDate(data.updatedAt) || "Waiting for first sync";
  }

  renderSpotlight(channel, ownerLatestVideo);
  renderMetrics(channel);
  renderMilestones(channel);
  renderVideosPage(ownerVideos, data.updatedAt);
  renderSeriesPage(playlists, data.updatedAt);
}

function renderMetrics(channel) {
  setMetric(els.subscriberCount, channel.subscriberCount, "Pending");
  setMetric(els.videoCount, channel.videoCount, "0");
  setMetric(els.viewCount, channel.viewCount, "Pending");
  setMetric(
    els.memberCount,
    channel.memberCount,
    channel.membershipsAvailable ? "Private" : "Soon"
  );
}

function renderSpotlight(channel, latestVideo) {
  if (!els.spotlightHeading || !els.spotlightDescription || !els.spotlightStatus) {
    return;
  }

  if (!latestVideo) {
    els.spotlightStatus.textContent = "Ready for the first upload";
    els.spotlightHeading.textContent = "First video incoming";
    els.spotlightDescription.textContent =
      "The newest public long-form upload or stream will appear here automatically once ThinkLink posts a video.";
    if (els.spotlightMeta) {
      els.spotlightMeta.innerHTML = `<span>No public videos yet</span><span>Spotlight armed</span>`;
    }
    if (els.spotlightImage) {
      els.spotlightImage.src = "assets/img/site-background.jpg";
    }
    if (els.spotlightPlay) {
      els.spotlightPlay.hidden = true;
    }
    return;
  }

  const state = getSpotlightState(latestVideo);
  els.spotlightStatus.textContent = state.status;
  els.spotlightHeading.textContent = latestVideo.title || "Latest ThinkLink video";
  els.spotlightDescription.textContent =
    latestVideo.description || state.description || "Watch the newest ThinkLink Minecraft upload.";

  if (els.spotlightMeta) {
    const meta = [
      state.status,
      latestVideo.playlistTitle ? `Series: ${latestVideo.playlistTitle}` : "Latest public video",
      formatShortDate(latestVideo.scheduledStartTime || latestVideo.publishedAt)
    ].filter(Boolean);
    els.spotlightMeta.innerHTML = meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  }

  if (els.spotlightImage) {
    els.spotlightImage.src = latestVideo.thumbnail || makeThumbnail(latestVideo.videoId);
    els.spotlightImage.alt = latestVideo.title || `${channel.title} latest video`;
  }

  if (els.spotlightPlay) {
    els.spotlightPlay.hidden = false;
    els.spotlightPlay.onclick = () => loadVideo(latestVideo.videoId);
  }
}

function getSpotlightState(video) {
  if (video.status === "live") {
    return {
      status: "Live now",
      description: "ThinkLink is live right now. Jump in while the stream is active."
    };
  }

  if (video.status === "upcoming") {
    return {
      status: "Premiere scheduled",
      description: "The next ThinkLink video is scheduled and will stay in the spotlight until it goes live."
    };
  }

  if (video.isEventRecap) {
    return {
      status: "Event recap",
      description: "The latest featured video is tied to an event, challenge, or community moment."
    };
  }

  return {
    status: "Latest upload",
    description: "The newest long-form ThinkLink upload or stream is always shown here."
  };
}

function loadVideo(videoId) {
  if (!videoId || !els.spotlightImage) {
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.title = "Latest ThinkLink YouTube video";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1`;
  els.spotlightImage.replaceWith(iframe);
  els.spotlightPlay?.remove();
}

function renderMilestones(channel) {
  if (!els.milestoneGrid) {
    return;
  }

  const milestones = [
    {
      label: "1K subscribers",
      value: channel.subscriberCount || 0,
      target: 1000,
      detail: "Build the first big ThinkLink crowd."
    },
    {
      label: "10 public videos",
      value: channel.videoCount || 0,
      target: 10,
      detail: "Enough uploads to make the channel feel alive."
    },
    {
      label: "10K channel views",
      value: channel.viewCount || 0,
      target: 10000,
      detail: "A strong early signal that people are watching."
    }
  ];

  els.milestoneGrid.innerHTML = milestones.map((milestone) => {
    const percent = clamp((milestone.value / milestone.target) * 100, 0, 100);
    const remaining = Math.max(0, milestone.target - milestone.value);

    return `
      <article class="milestone-card">
        <div class="milestone-card__head">
          <h3>${escapeHtml(milestone.label)}</h3>
          <strong>${Math.round(percent)}%</strong>
        </div>
        <div class="progress-track" aria-label="${escapeHtml(milestone.label)} progress">
          <span style="width: ${percent}%"></span>
        </div>
        <p>${escapeHtml(compactNumber(milestone.value))} / ${escapeHtml(compactNumber(milestone.target))}</p>
        <span>${remaining === 0 ? "Goal reached" : `${escapeHtml(compactNumber(remaining))} to go`}</span>
      </article>
    `;
  }).join("");
}

function renderSeriesPage(playlists, updatedAt) {
  if (!els.seriesGrid) {
    return;
  }

  const safePlaylists = Array.isArray(playlists) ? playlists : [];
  if (els.seriesCount) {
    els.seriesCount.textContent = `${safePlaylists.length} public ${safePlaylists.length === 1 ? "playlist" : "playlists"}`;
  }
  if (els.seriesUpdated) {
    els.seriesUpdated.textContent = `Last sync ${formatDate(updatedAt) || "pending"}`;
  }

  if (safePlaylists.length === 0) {
    els.seriesGrid.innerHTML = `
      <article class="empty-series">
        <p class="section-kicker">Coming soon</p>
        <h2>No public playlists yet</h2>
        <p>When ThinkLink creates public playlists, they will appear here automatically, including empty ones.</p>
        <a class="button button--primary" href="https://www.youtube.com/@ThinkLink_YT/playlists" rel="noopener" target="_blank">
          Open YouTube playlists <span class="button__icon" aria-hidden="true">-&gt;</span>
        </a>
      </article>
    `;
    return;
  }

  els.seriesGrid.innerHTML = safePlaylists.map((playlist) => renderPlaylistCard(playlist)).join("");
}

function renderVideosPage(videos, updatedAt) {
  if (!els.videoGrid) {
    return;
  }

  const safeVideos = Array.isArray(videos) ? videos.filter(isDisplayableOwnerVideo) : [];
  if (els.videosCount) {
    els.videosCount.textContent = `${safeVideos.length} ${safeVideos.length === 1 ? "video" : "videos"}`;
  }
  if (els.videosUpdated) {
    els.videosUpdated.textContent = `Last sync ${formatDate(updatedAt) || "pending"}`;
  }

  if (safeVideos.length === 0) {
    els.videoGrid.innerHTML = `
      <article class="empty-series">
        <p class="section-kicker">Coming soon</p>
        <h2>No long-form videos yet</h2>
        <p>When ThinkLink has public long-form uploads or streams posted on this channel, they will appear here automatically. Shorts and off-channel collaborations are intentionally left out.</p>
        <a class="button button--primary" href="https://www.youtube.com/@ThinkLink_YT/videos" rel="noopener" target="_blank">
          Open YouTube videos <span class="button__icon" aria-hidden="true">-&gt;</span>
        </a>
      </article>
    `;
    return;
  }

  els.videoGrid.innerHTML = safeVideos.map((video) => renderVideoCard(video)).join("");
}

function renderVideoCard(video) {
  const thumbnail = safeUrl(video.thumbnail || makeThumbnail(video.videoId));
  const url = safeUrl(video.url || `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`);
  const meta = [
    video.duration,
    video.publishedAtText || formatShortDate(video.publishedAt),
    video.viewCount !== null && video.viewCount !== undefined ? `${compactNumber(video.viewCount)} views` : ""
  ].filter(Boolean);
  const badge = video.status === "live" ? "Live now" : video.status === "upcoming" ? "Scheduled" : video.duration || "Video";

  return `
    <article class="video-card">
      <a class="video-card__media" href="${url}" rel="noopener" target="_blank" aria-label="${escapeHtml(video.title || "ThinkLink video")}">
        <img src="${thumbnail}" alt="">
        <span>${escapeHtml(badge)}</span>
      </a>
      <div class="video-card__body">
        <h3>${escapeHtml(video.title || "Untitled video")}</h3>
        <p>${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</p>
        <a class="text-link" href="${url}" rel="noopener" target="_blank">Watch on YouTube</a>
      </div>
    </article>
  `;
}

function renderPlaylistCard(playlist) {
  const latest = playlist.latestVideo;
  const thumbnail = safeUrl(playlist.thumbnail || latest?.thumbnail || "assets/img/site-background.jpg");
  const title = playlist.title || "Untitled series";
  const itemCount = Number(playlist.itemCount) || 0;
  const badge = itemCount === 0 ? "Empty playlist" : `${compactNumber(itemCount)} ${itemCount === 1 ? "video" : "videos"}`;
  const url = safeUrl(playlist.url || "https://www.youtube.com/@ThinkLink_YT/playlists");

  return `
    <article class="series-card">
      <a class="series-card__media" href="${url}" rel="noopener" target="_blank" aria-label="${escapeHtml(title)} playlist">
        <img src="${thumbnail}" alt="">
        <span>${escapeHtml(badge)}</span>
      </a>
      <div class="series-card__body">
        <p class="section-kicker">${itemCount === 0 ? "Ready slot" : "Playlist"}</p>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(playlist.description || latest?.title || "This series is ready for future ThinkLink uploads.")}</p>
        <a class="text-link" href="${url}" rel="noopener" target="_blank">View playlist</a>
      </div>
    </article>
  `;
}

function makeThumbnail(videoId) {
  return videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` : "assets/img/site-background.jpg";
}

function isDisplayableOwnerVideo(video) {
  if (!video || video.isOwnerUpload !== true || video.isShort === true) {
    return false;
  }

  if (video.isStream === true) {
    return true;
  }

  return Number(video.durationSeconds) > 180;
}

function setMetric(element, value, fallback) {
  if (!element) {
    return;
  }

  if (value === null || value === undefined || value === "") {
    element.textContent = fallback;
    return;
  }

  const number = Number(value);
  element.textContent = Number.isFinite(number) ? compactNumber(number) : String(value);
}

function compactNumber(value) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value < 10000 ? 0 : 1
  }).format(value);
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatShortDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeUrl(value) {
  if (!value) {
    return "";
  }

  if (/^(https:\/\/|assets\/)/.test(value)) {
    return escapeHtml(value);
  }

  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

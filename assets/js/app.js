const DATA_URL = "data/channel.json";
const FALLBACK = {
  channel: {
    id: "UCKoSe3mZp5VI5psWORRbObA",
    title: "ThinkLink",
    handle: "@ThinkLink_YT",
    url: "https://www.youtube.com/@ThinkLink_YT/featured",
    description:
      "I play Modded Minecraft with my friends along with Hive live to keep it different sometimes. I also host Minecraft events and spend a ton of time editing.",
    subscriberCount: null,
    viewCount: null,
    videoCount: 0,
    memberCount: null,
    membershipsAvailable: false
  },
  latestVideo: null,
  updatedAt: null
};

const els = {
  spotlightImage: document.querySelector("#spotlight-image"),
  spotlightPlay: document.querySelector("#spotlight-play"),
  spotlightStatus: document.querySelector("#spotlight-status"),
  spotlightHeading: document.querySelector("#spotlight-heading"),
  spotlightDescription: document.querySelector("#spotlight-description"),
  watchLink: document.querySelector("#watch-link"),
  aboutText: document.querySelector("#about-text"),
  subscriberCount: document.querySelector("#subscriber-count"),
  videoCount: document.querySelector("#video-count"),
  viewCount: document.querySelector("#view-count"),
  memberCount: document.querySelector("#member-count"),
  lastUpdated: document.querySelector("#last-updated")
};

init();

async function init() {
  const data = await loadChannelData();
  render(data);
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
    }
  };
}

function render(data) {
  const { channel, latestVideo } = data;

  document.title = `${channel.title} | Minecraft Videos, Events, and Live Moments`;
  els.aboutText.textContent = channel.description || FALLBACK.channel.description;
  els.watchLink.href = latestVideo?.url || channel.url || FALLBACK.channel.url;
  els.lastUpdated.textContent = formatDate(data.updatedAt) || "Waiting for first sync";

  renderSpotlight(channel, latestVideo);
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
  if (!latestVideo) {
    els.spotlightStatus.textContent = "Ready for the first upload";
    els.spotlightHeading.textContent = "First video incoming";
    els.spotlightDescription.textContent =
      "The newest public upload will appear here automatically once ThinkLink posts a video.";
    els.spotlightImage.src = "assets/img/thinklink-hero.png";
    els.spotlightPlay.hidden = true;
    return;
  }

  els.spotlightStatus.textContent = "Latest upload";
  els.spotlightHeading.textContent = latestVideo.title || "Latest ThinkLink video";
  els.spotlightDescription.textContent =
    latestVideo.description || "Watch the newest ThinkLink Minecraft upload.";
  els.spotlightImage.src = latestVideo.thumbnail || makeThumbnail(latestVideo.videoId);
  els.spotlightImage.alt = latestVideo.title || `${channel.title} latest video`;
  els.spotlightPlay.hidden = false;
  els.spotlightPlay.onclick = () => loadVideo(latestVideo.videoId);
}

function loadVideo(videoId) {
  if (!videoId) {
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.title = "Latest ThinkLink YouTube video";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1`;
  els.spotlightImage.replaceWith(iframe);
  els.spotlightPlay.remove();
}

function makeThumbnail(videoId) {
  return videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/maxresdefault.jpg` : "assets/img/thinklink-hero.png";
}

function setMetric(element, value, fallback) {
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

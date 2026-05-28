import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CHANNEL_ID = "UCKoSe3mZp5VI5psWORRbObA";
const CHANNEL_HANDLE = "@ThinkLink_YT";
const CHANNEL_URL = "https://www.youtube.com/@ThinkLink_YT/featured";
const DATA_FILE = fileURLToPath(new URL("../data/channel.json", import.meta.url));
const API_KEY = process.env.YOUTUBE_API_KEY;

const existing = readExistingData();
const next = await buildChannelData();
writeData(next);

async function buildChannelData() {
  if (API_KEY) {
    try {
      return await fromYouTubeApi();
    } catch (error) {
      console.warn(`YouTube API update failed, falling back to public data: ${error.message}`);
    }
  }

  return fromPublicFeeds();
}

async function fromYouTubeApi() {
  const channelResponse = await fetchJson(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${CHANNEL_ID}&key=${API_KEY}`
  );
  const item = channelResponse.items?.[0];

  if (!item) {
    throw new Error("Channel not found");
  }

  const uploads = item.contentDetails?.relatedPlaylists?.uploads;
  const latestVideo = uploads ? await latestFromPlaylist(uploads) : null;

  return {
    channel: {
      id: CHANNEL_ID,
      title: item.snippet?.title || "ThinkLink",
      handle: CHANNEL_HANDLE,
      url: CHANNEL_URL,
      description: item.snippet?.description || existing.channel?.description || "",
      thumbnail: bestThumbnail(item.snippet?.thumbnails),
      subscriberCount: toNumber(item.statistics?.subscriberCount),
      viewCount: toNumber(item.statistics?.viewCount),
      videoCount: toNumber(item.statistics?.videoCount),
      memberCount: existing.channel?.memberCount ?? null,
      membershipsAvailable: existing.channel?.membershipsAvailable ?? false
    },
    latestVideo,
    updatedAt: new Date().toISOString(),
    source: "youtube-api"
  };
}

async function latestFromPlaylist(playlistId) {
  const playlistResponse = await fetchJson(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=1&key=${API_KEY}`
  );
  const item = playlistResponse.items?.[0];

  if (!item?.snippet?.resourceId?.videoId) {
    return null;
  }

  const videoId = item.snippet.resourceId.videoId;
  return {
    videoId,
    title: item.snippet.title,
    description: cleanDescription(item.snippet.description),
    publishedAt: item.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: bestThumbnail(item.snippet.thumbnails)
  };
}

async function fromPublicFeeds() {
  const [feed, aboutHtml] = await Promise.allSettled([
    fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`),
    fetchText("https://www.youtube.com/@ThinkLink_YT/about")
  ]);

  const latestVideo = feed.status === "fulfilled" ? latestFromRss(feed.value) : null;
  const description = aboutHtml.status === "fulfilled"
    ? extractMetaDescription(aboutHtml.value)
    : existing.channel?.description;

  return {
    channel: {
      id: CHANNEL_ID,
      title: "ThinkLink",
      handle: CHANNEL_HANDLE,
      url: CHANNEL_URL,
      description: description || existing.channel?.description || "",
      thumbnail: existing.channel?.thumbnail || null,
      subscriberCount: existing.channel?.subscriberCount ?? null,
      viewCount: existing.channel?.viewCount ?? null,
      videoCount: latestVideo ? Math.max(existing.channel?.videoCount || 1, 1) : existing.channel?.videoCount ?? 0,
      memberCount: existing.channel?.memberCount ?? null,
      membershipsAvailable: existing.channel?.membershipsAvailable ?? false
    },
    latestVideo,
    updatedAt: new Date().toISOString(),
    source: "public-feed"
  };
}

function latestFromRss(xml) {
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entry) {
    return null;
  }

  const block = entry[1];
  const videoId = text(block, "yt:videoId");
  const title = text(block, "title");
  const publishedAt = text(block, "published");
  const description = text(block, "media:description");

  if (!videoId) {
    return null;
  }

  return {
    videoId,
    title: decodeXml(title),
    description: cleanDescription(decodeXml(description)),
    publishedAt,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "ThinkLinkWebsite/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 ThinkLinkWebsite/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.text();
}

function extractMetaDescription(html) {
  const match = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return match ? decodeXml(match[1]).replace(/\s+/g, " ").trim() : "";
}

function text(block, tag) {
  const match = block.match(new RegExp(`<${escapeRegExp(tag)}[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tag)}>`, "i"));
  return match ? match[1].trim() : "";
}

function bestThumbnail(thumbnails = {}) {
  return thumbnails.maxres?.url
    || thumbnails.standard?.url
    || thumbnails.high?.url
    || thumbnails.medium?.url
    || thumbnails.default?.url
    || null;
}

function cleanDescription(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function decodeXml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readExistingData() {
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeData(data) {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

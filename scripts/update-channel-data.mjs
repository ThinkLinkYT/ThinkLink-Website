import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CHANNEL_ID = "UCKoSe3mZp5VI5psWORRbObA";
const CHANNEL_HANDLE = "@ThinkLink_YT";
const CHANNEL_URL = "https://www.youtube.com/@ThinkLink_YT/featured";
const PLAYLISTS_URL = "https://www.youtube.com/@ThinkLink_YT/playlists";
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
  const playlists = await playlistsFromApi();

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
    playlists,
    updatedAt: new Date().toISOString(),
    source: "youtube-api"
  };
}

async function latestFromPlaylist(playlistId, playlistTitle = "") {
  const playlistResponse = await fetchJson(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=1&key=${API_KEY}`
  );
  const item = playlistResponse.items?.[0];

  if (!item?.snippet?.resourceId?.videoId) {
    return null;
  }

  const videoId = item.snippet.resourceId.videoId;
  return enrichVideoFromApi({
    videoId,
    title: item.snippet.title,
    description: cleanDescription(item.snippet.description),
    publishedAt: item.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: bestThumbnail(item.snippet.thumbnails),
    playlistTitle
  });
}

async function playlistsFromApi() {
  const playlistResponse = await fetchJson(
    `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${CHANNEL_ID}&maxResults=50&key=${API_KEY}`
  );

  const playlists = playlistResponse.items || [];
  const withLatest = await Promise.all(playlists.map(async (playlist) => {
    const itemCount = toNumber(playlist.contentDetails?.itemCount) || 0;
    const latestVideo = itemCount > 0 ? await latestFromPlaylist(playlist.id, playlist.snippet?.title || "") : null;

    return {
      id: playlist.id,
      title: playlist.snippet?.title || "Untitled series",
      description: cleanDescription(playlist.snippet?.description || ""),
      itemCount,
      thumbnail: bestThumbnail(playlist.snippet?.thumbnails) || latestVideo?.thumbnail || null,
      url: `https://www.youtube.com/playlist?list=${playlist.id}`,
      latestVideo,
      isEmpty: itemCount === 0
    };
  }));

  return withLatest;
}

async function enrichVideoFromApi(video) {
  try {
    const videoResponse = await fetchJson(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${video.videoId}&key=${API_KEY}`
    );
    const item = videoResponse.items?.[0];
    const liveState = item?.snippet?.liveBroadcastContent;
    const scheduledStartTime = item?.liveStreamingDetails?.scheduledStartTime;

    return {
      ...video,
      status: getSpotlightStatus(liveState, scheduledStartTime),
      scheduledStartTime: scheduledStartTime || null,
      isEventRecap: looksLikeEventRecap(video)
    };
  } catch {
    return {
      ...video,
      status: "published",
      scheduledStartTime: null,
      isEventRecap: looksLikeEventRecap(video)
    };
  }
}

async function fromPublicFeeds() {
  const [feed, aboutHtml, playlistsHtml] = await Promise.allSettled([
    fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`),
    fetchText("https://www.youtube.com/@ThinkLink_YT/about"),
    fetchText(PLAYLISTS_URL)
  ]);

  const latestVideo = feed.status === "fulfilled" ? latestFromRss(feed.value) : null;
  const publicChannel = aboutHtml.status === "fulfilled"
    ? extractPublicChannelData(aboutHtml.value)
    : {};
  const playlists = playlistsHtml.status === "fulfilled"
    ? extractPublicPlaylists(playlistsHtml.value)
    : existing.playlists || [];

  return {
    channel: {
      id: CHANNEL_ID,
      title: publicChannel.title || "ThinkLink",
      handle: CHANNEL_HANDLE,
      url: CHANNEL_URL,
      description: publicChannel.description || existing.channel?.description || "",
      thumbnail: existing.channel?.thumbnail || null,
      subscriberCount: publicChannel.subscriberCount ?? existing.channel?.subscriberCount ?? null,
      viewCount: publicChannel.viewCount ?? existing.channel?.viewCount ?? null,
      videoCount: latestVideo ? Math.max(existing.channel?.videoCount || 1, 1) : existing.channel?.videoCount ?? 0,
      memberCount: existing.channel?.memberCount ?? null,
      membershipsAvailable: existing.channel?.membershipsAvailable ?? false
    },
    latestVideo,
    playlists,
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
    thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    status: "published",
    scheduledStartTime: null,
    isEventRecap: looksLikeEventRecap({ title, description })
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

function extractPublicChannelData(html) {
  const aboutIndex = html.lastIndexOf("\"aboutChannelViewModel\"");
  const segment = aboutIndex >= 0 ? html.slice(aboutIndex, aboutIndex + 7000) : html;

  return {
    title: extractJsonString(segment, "title"),
    description: extractJsonString(segment, "description") || extractMetaDescription(html),
    subscriberCount: parsePublicCount(extractJsonString(segment, "subscriberCountText")),
    viewCount: parsePublicCount(extractJsonString(segment, "viewCountText"))
  };
}

function extractPublicPlaylists(html) {
  if (/This channel has no playlists\./i.test(html)) {
    return [];
  }

  const playlistIds = [...html.matchAll(/"playlistId"\s*:\s*"([^"]+)"/g)]
    .map((match) => match[1])
    .filter(unique);

  return playlistIds.map((id) => {
    const index = html.indexOf(id);
    const segment = html.slice(Math.max(0, index - 2000), index + 4000);
    const title = extractFirstText(segment, [
      /"title"\s*:\s*"((?:\\.|[^"\\])*)"/,
      /"simpleText"\s*:\s*"((?:\\.|[^"\\])*)"/
    ]) || "Untitled series";
    const itemCount = parsePublicCount(extractFirstText(segment, [
      /"videoCountText"\s*:\s*"((?:\\.|[^"\\])*)"/,
      /"text"\s*:\s*"((?:\\.|[^"\\])*) videos?"/
    ])) || 0;

    return {
      id,
      title,
      description: "",
      itemCount,
      thumbnail: extractThumbnail(segment),
      url: `https://www.youtube.com/playlist?list=${id}`,
      latestVideo: null,
      isEmpty: itemCount === 0
    };
  });
}

function extractJsonString(source, key) {
  const match = source.match(new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  return match ? decodeJsonString(match[1]).replace(/\s+/g, " ").trim() : "";
}

function extractFirstText(source, patterns) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) {
      return decodeJsonString(match[1]).replace(/\s+/g, " ").trim();
    }
  }

  return "";
}

function extractThumbnail(source) {
  const matches = [...source.matchAll(/"url"\s*:\s*"(https:\/\/i\.ytimg\.com\/[^"]+)"/g)];
  return matches.at(-1)?.[1] || null;
}

function parsePublicCount(value = "") {
  const match = value.replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!match) {
    return null;
  }

  const multipliers = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
  const number = Number(match[1]);
  const multiplier = multipliers[match[2]?.toUpperCase()] || 1;
  return Number.isFinite(number) ? Math.round(number * multiplier) : null;
}

function getSpotlightStatus(liveState, scheduledStartTime) {
  if (liveState === "live") {
    return "live";
  }

  if (liveState === "upcoming" || (scheduledStartTime && new Date(scheduledStartTime) > new Date())) {
    return "upcoming";
  }

  return "published";
}

function looksLikeEventRecap(video) {
  const value = `${video.title || ""} ${video.description || ""} ${video.playlistTitle || ""}`.toLowerCase();
  return /\b(event|recap|finale|tournament|challenge)\b/.test(value);
}

function unique(value, index, array) {
  return array.indexOf(value) === index;
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

function decodeJsonString(value = "") {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  }
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

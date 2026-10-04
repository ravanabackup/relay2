export interface VideoTrackInfo {
  id: number | string;
  codec: string;
  codecFullName: string;
  width: number;
  height: number;
  fps?: number;
  bitrate?: number;
  aspectRatio?: string;
  isSupportedByBrowser: boolean;
}

export interface AudioTrackInfo {
  id: number | string;
  trackNumber: number;
  codec: string;
  codecFullName: string;
  title: string;
  language: string;
  languageLabel: string;
  channels: number;
  channelsDescription: string;
  sampleRate: number;
  bitDepth?: number;
  bitrate?: number;
  isDefault?: boolean;
  isSupportedByBrowser: boolean;
}

export interface SubtitleTrackInfo {
  id: number | string;
  trackNumber: number;
  codec: string;
  title: string;
  language: string;
  languageLabel: string;
  isDefault?: boolean;
  isExternal?: boolean;
  content?: string;
}

export interface MediaInfo {
  container: string;
  containerFullName: string;
  fileSize: number;
  duration?: number;
  overallBitrate?: number;
  videoTracks: VideoTrackInfo[];
  audioTracks: AudioTrackInfo[];
  subtitleTracks: SubtitleTrackInfo[];
  hasMultiAudio: boolean;
  isFullySupportedNatively: boolean;
  unsupportedReasons: string[];
}

const LANGUAGE_NAMES: Record<string, string> = {
  eng: 'English', en: 'English',
  jpn: 'Japanese', ja: 'Japanese',
  spa: 'Spanish', es: 'Spanish',
  fra: 'French', fre: 'French', fr: 'French',
  deu: 'German', ger: 'German', de: 'German',
  ita: 'Italian', it: 'Italian',
  por: 'Portuguese', pt: 'Portuguese',
  rus: 'Russian', ru: 'Russian',
  zho: 'Chinese', chi: 'Chinese', zh: 'Chinese',
  kor: 'Korean', ko: 'Korean',
  ara: 'Arabic', ar: 'Arabic',
  hin: 'Hindi', hi: 'Hindi',
  und: 'Undetermined',
};

export function getLanguageName(code: string): string {
  if (!code) return 'Unknown';
  const clean = code.toLowerCase().trim();
  return LANGUAGE_NAMES[clean] || clean.toUpperCase();
}

function checkVideoCodecSupport(codec: string, _width = 1920, _height = 1080): boolean {
  if (typeof document === 'undefined') return true;
  const video = document.createElement('video');
  const clean = codec.toLowerCase();

  if (clean.includes('avc') || clean.includes('h264') || clean.includes('avc1')) {
    return Boolean(video.canPlayType('video/mp4; codecs="avc1.640028"') || video.canPlayType('video/mp4; codecs="avc1.42E01E"'));
  }
  if (clean.includes('vp9') || clean.includes('vp09')) {
    return Boolean(video.canPlayType('video/webm; codecs="vp9"') || video.canPlayType('video/mp4; codecs="vp09.00.10.08"'));
  }
  if (clean.includes('av1') || clean.includes('av01')) {
    return Boolean(video.canPlayType('video/mp4; codecs="av01.0.08M.08"') || video.canPlayType('video/webm; codecs="av1"'));
  }
  if (clean.includes('vp8')) {
    return Boolean(video.canPlayType('video/webm; codecs="vp8"'));
  }
  if (clean.includes('hevc') || clean.includes('h265') || clean.includes('hvc1') || clean.includes('hev1')) {
    return Boolean(video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') || video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"'));
  }
  return false;
}

function checkAudioCodecSupport(codec: string): boolean {
  if (typeof document === 'undefined') return true;
  const audio = document.createElement('audio');
  const clean = codec.toLowerCase();

  if (clean.includes('aac') || clean.includes('mp4a')) {
    return Boolean(audio.canPlayType('audio/mp4; codecs="mp4a.40.2"'));
  }
  if (clean.includes('opus')) {
    return Boolean(audio.canPlayType('audio/ogg; codecs="opus"') || audio.canPlayType('audio/webm; codecs="opus"'));
  }
  if (clean.includes('vorbis')) {
    return Boolean(audio.canPlayType('audio/ogg; codecs="vorbis"') || audio.canPlayType('audio/webm; codecs="vorbis"'));
  }
  if (clean.includes('mp3') || clean.includes('mpeg')) {
    return Boolean(audio.canPlayType('audio/mpeg'));
  }
  if (clean.includes('flac')) {
    return Boolean(audio.canPlayType('audio/flac') || audio.canPlayType('audio/mp4; codecs="flac"'));
  }
  if (clean.includes('pcm') || clean.includes('wav')) {
    return Boolean(audio.canPlayType('audio/wav'));
  }
  // AC-3, E-AC-3, DTS are typically unsupported by standard browsers without special hardware decoders
  if (clean.includes('ac-3') || clean.includes('ac3')) {
    return Boolean(audio.canPlayType('audio/mp4; codecs="ac-3"'));
  }
  if (clean.includes('ec-3') || clean.includes('eac3')) {
    return Boolean(audio.canPlayType('audio/mp4; codecs="ec-3"'));
  }
  if (clean.includes('dts')) {
    return Boolean(audio.canPlayType('audio/mp4; codecs="dts"'));
  }
  return false;
}

export function formatChannels(channels: number): string {
  if (channels === 1) return 'Mono (1.0)';
  if (channels === 2) return 'Stereo (2.0)';
  if (channels === 6) return '5.1 Surround';
  if (channels === 8) return '7.1 Surround';
  if (channels > 2) return `${channels} Channels`;
  return `${channels || 2} Ch`;
}

// ----------------------------------------------------
// ISO Base Media File Format (MP4 / M4V / MOV) Parser
// ----------------------------------------------------
async function parseMp4(file: File): Promise<Partial<MediaInfo>> {
  // Read first 2MB or whole file for metadata
  const sliceSize = Math.min(file.size, 4 * 1024 * 1024);
  const buffer = await file.slice(0, sliceSize).arrayBuffer();
  const view = new DataView(buffer);

  const videoTracks: VideoTrackInfo[] = [];
  const audioTracks: AudioTrackInfo[] = [];
  const subtitleTracks: SubtitleTrackInfo[] = [];
  let duration: number | undefined;

  let offset = 0;
  while (offset + 8 <= view.byteLength) {
    let boxSize = view.getUint32(offset);
    const boxType = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );

    if (boxSize === 1) {
      if (offset + 16 > view.byteLength) break;
      boxSize = Number(view.getBigUint64(offset + 8));
      offset += 16;
    } else if (boxSize === 0) {
      boxSize = view.byteLength - offset;
    }

    if (boxType === 'moov') {
      parseMoovBox(view, offset + 8, Math.min(view.byteLength, offset + boxSize), {
        videoTracks,
        audioTracks,
        subtitleTracks,
        setDuration: (d) => { duration = d; },
      });
      break;
    }

    offset += boxSize;
    if (boxSize <= 0) break;
  }

  return {
    container: 'MP4 / QuickTime',
    containerFullName: 'MPEG-4 Part 14 / QuickTime ISO Media',
    duration,
    videoTracks,
    audioTracks,
    subtitleTracks,
  };
}

function parseMoovBox(
  view: DataView,
  start: number,
  end: number,
  out: {
    videoTracks: VideoTrackInfo[];
    audioTracks: AudioTrackInfo[];
    subtitleTracks: SubtitleTrackInfo[];
    setDuration: (d: number) => void;
  }
) {
  let offset = start;
  while (offset + 8 <= end) {
    const boxSize = view.getUint32(offset);
    if (boxSize < 8 || offset + boxSize > end) break;
    const boxType = getString(view, offset + 4, 4);

    if (boxType === 'mvhd') {
      const version = view.getUint8(offset + 8);
      const timescaleOffset = offset + 8 + (version === 1 ? 20 : 12);
      if (timescaleOffset + 8 <= end) {
        const timescale = view.getUint32(timescaleOffset);
        const durationUnits = version === 1 ? Number(view.getBigUint64(timescaleOffset + 4)) : view.getUint32(timescaleOffset + 4);
        if (timescale > 0) out.setDuration(durationUnits / timescale);
      }
    } else if (boxType === 'trak') {
      parseTrakBox(view, offset + 8, offset + boxSize, out);
    }

    offset += boxSize;
  }
}

function parseTrakBox(
  view: DataView,
  start: number,
  end: number,
  out: {
    videoTracks: VideoTrackInfo[];
    audioTracks: AudioTrackInfo[];
    subtitleTracks: SubtitleTrackInfo[];
  }
) {
  let offset = start;
  let trackId = 1;
  let handlerType = '';
  let codec = 'Unknown';
  let width = 0;
  let height = 0;
  let sampleRate = 48000;
  let channels = 2;
  let language = 'und';
  let trackName = '';

  while (offset + 8 <= end) {
    const boxSize = view.getUint32(offset);
    if (boxSize < 8 || offset + boxSize > end) break;
    const boxType = getString(view, offset + 4, 4);

    if (boxType === 'tkhd') {
      const version = view.getUint8(offset + 8);
      const tkhdTrackIdOffset = offset + 8 + (version === 1 ? 16 : 12);
      if (tkhdTrackIdOffset + 4 <= end) {
        trackId = view.getUint32(tkhdTrackIdOffset);
      }
      const dimOffset = offset + boxSize - 8;
      if (dimOffset >= offset + 8) {
        width = view.getUint32(dimOffset) >> 16;
        height = view.getUint32(dimOffset + 4) >> 16;
      }
    } else if (boxType === 'mdia') {
      let mOffset = offset + 8;
      const mEnd = offset + boxSize;
      while (mOffset + 8 <= mEnd) {
        const mSize = view.getUint32(mOffset);
        if (mSize < 8 || mOffset + mSize > mEnd) break;
        const mType = getString(view, mOffset + 4, 4);

        if (mType === 'mdhd') {
          const v = view.getUint8(mOffset + 8);
          const langOffset = mOffset + 8 + (v === 1 ? 24 : 16);
          if (langOffset + 2 <= mEnd) {
            const langCode = view.getUint16(langOffset);
            const c1 = String.fromCharCode(((langCode >> 10) & 0x1f) + 0x60);
            const c2 = String.fromCharCode(((langCode >> 5) & 0x1f) + 0x60);
            const c3 = String.fromCharCode((langCode & 0x1f) + 0x60);
            language = `${c1}${c2}${c3}`;
          }
        } else if (mType === 'hdlr') {
          if (mOffset + 16 <= mEnd) {
            handlerType = getString(view, mOffset + 16, 4);
          }
        } else if (mType === 'minf') {
          let sOffset = mOffset + 8;
          const sEnd = mOffset + mSize;
          while (sOffset + 8 <= sEnd) {
            const sSize = view.getUint32(sOffset);
            if (sSize < 8 || sOffset + sSize > sEnd) break;
            const sType = getString(view, sOffset + 4, 4);
            if (sType === 'stbl') {
              let tOffset = sOffset + 8;
              const tEnd = sOffset + sSize;
              while (tOffset + 8 <= tEnd) {
                const tSize = view.getUint32(tOffset);
                if (tSize < 8 || tOffset + tSize > tEnd) break;
                const tType = getString(view, tOffset + 4, 4);
                if (tType === 'stsd' && tOffset + 16 <= tEnd) {
                  const entryCount = view.getUint32(tOffset + 12);
                  if (entryCount > 0 && tOffset + 24 <= tEnd) {
                    codec = getString(view, tOffset + 20, 4);
                    if (handlerType === 'soun' && tOffset + 44 <= tEnd) {
                      channels = view.getUint16(tOffset + 36) || 2;
                      sampleRate = (view.getUint32(tOffset + 40) >> 16) || 48000;
                    }
                  }
                }
                tOffset += tSize;
              }
            }
            sOffset += sSize;
          }
        }
        mOffset += mSize;
      }
    }

    offset += boxSize;
  }

  if (handlerType === 'vide') {
    const isSupported = checkVideoCodecSupport(codec, width, height);
    out.videoTracks.push({
      id: trackId,
      codec,
      codecFullName: getCodecFullName(codec, 'video'),
      width: width || 1920,
      height: height || 1080,
      isSupportedByBrowser: isSupported,
    });
  } else if (handlerType === 'soun') {
    const isSupported = checkAudioCodecSupport(codec);
    out.audioTracks.push({
      id: trackId,
      trackNumber: out.audioTracks.length + 1,
      codec,
      codecFullName: getCodecFullName(codec, 'audio'),
      title: trackName || `Audio Track ${out.audioTracks.length + 1} (${getLanguageName(language)})`,
      language,
      languageLabel: getLanguageName(language),
      channels,
      channelsDescription: formatChannels(channels),
      sampleRate,
      isSupportedByBrowser: isSupported,
      isDefault: out.audioTracks.length === 0,
    });
  } else if (handlerType === 'sbtl' || handlerType === 'text') {
    out.subtitleTracks.push({
      id: trackId,
      trackNumber: out.subtitleTracks.length + 1,
      codec,
      title: `Subtitle Track ${out.subtitleTracks.length + 1} (${getLanguageName(language)})`,
      language,
      languageLabel: getLanguageName(language),
      isDefault: out.subtitleTracks.length === 0,
    });
  }
}

function getString(view: DataView, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length && offset + i < view.byteLength; i++) {
    const code = view.getUint8(offset + i);
    if (code >= 32 && code <= 126) str += String.fromCharCode(code);
    else str += ' ';
  }
  return str.trim();
}

function getCodecFullName(codec: string, type: 'video' | 'audio'): string {
  const c = codec.toLowerCase();
  if (type === 'video') {
    if (c === 'avc1' || c === 'h264') return 'H.264 / AVC (Advanced Video Coding)';
    if (c === 'hev1' || c === 'hvc1' || c === 'h265') return 'H.265 / HEVC (High Efficiency Video Coding)';
    if (c === 'vp09' || c === 'vp9') return 'Google VP9';
    if (c === 'av01' || c === 'av1') return 'AOMedia Video 1 (AV1)';
    if (c === 'vp8') return 'Google VP8';
    if (c === 'mp4v') return 'MPEG-4 Part 2 Video';
    return codec.toUpperCase();
  } else {
    if (c === 'mp4a') return 'MPEG-4 AAC Audio';
    if (c === 'ac-3' || c === 'ac3') return 'Dolby Digital AC-3 (5.1)';
    if (c === 'ec-3' || c === 'eac3') return 'Dolby Digital Plus (E-AC-3)';
    if (c === 'dts') return 'DTS Digital Surround';
    if (c === 'opus') return 'Opus Audio';
    if (c === 'flac') return 'Free Lossless Audio Codec (FLAC)';
    if (c === 'alac') return 'Apple Lossless Audio Codec (ALAC)';
    if (c === 'mp3' || c === '.mp3') return 'MPEG Audio Layer 3 (MP3)';
    if (c === 'vorbis') return 'Ogg Vorbis Audio';
    return codec.toUpperCase();
  }
}

// ----------------------------------------------------
// Matroska / WebM EBML Parser (MKV / WebM)
// ----------------------------------------------------
async function parseMatroska(file: File): Promise<Partial<MediaInfo>> {
  const sliceSize = Math.min(file.size, 8 * 1024 * 1024);
  const buffer = await file.slice(0, sliceSize).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const videoTracks: VideoTrackInfo[] = [];
  const audioTracks: AudioTrackInfo[] = [];
  const subtitleTracks: SubtitleTrackInfo[] = [];
  let duration: number | undefined;

  function readVint(start: number): { value: number; length: number } | null {
    if (start >= bytes.length) return null;
    const firstByte = bytes[start];
    let mask = 0x80;
    let length = 1;
    while (length <= 8 && !(firstByte & mask)) {
      mask >>= 1;
      length++;
    }
    if (length > 8) return null;
    let val = firstByte & (mask - 1);
    for (let i = 1; i < length; i++) {
      if (start + i >= bytes.length) return null;
      val = (val << 8) | bytes[start + i];
    }
    return { value: val, length };
  }

  function readId(start: number): { id: number; length: number } | null {
    if (start >= bytes.length) return null;
    const firstByte = bytes[start];
    let mask = 0x80;
    let length = 1;
    while (length <= 4 && !(firstByte & mask)) {
      mask >>= 1;
      length++;
    }
    if (length > 4) return null;
    let id = 0;
    for (let i = 0; i < length; i++) {
      if (start + i >= bytes.length) return null;
      id = (id << 8) | bytes[start + i];
    }
    return { id, length };
  }

  // Look for Tracks element (ID 0x1654AE6B)
  let tracksOffset = -1;
  for (let i = 0; i < bytes.length - 4; i++) {
    if (bytes[i] === 0x16 && bytes[i + 1] === 0x54 && bytes[i + 2] === 0xae && bytes[i + 3] === 0x6b) {
      tracksOffset = i;
      break;
    }
  }

  if (tracksOffset !== -1) {
    const idRes = readId(tracksOffset);
    if (idRes) {
      const sizeRes = readVint(tracksOffset + idRes.length);
      if (sizeRes) {
        const tracksStart = tracksOffset + idRes.length + sizeRes.length;
        const tracksEnd = Math.min(bytes.length, tracksStart + sizeRes.value);
        let cur = tracksStart;

        while (cur < tracksEnd) {
          const entryIdRes = readId(cur);
          if (!entryIdRes) break;
          const entrySizeRes = readVint(cur + entryIdRes.length);
          if (!entrySizeRes) break;
          const entryStart = cur + entryIdRes.length + entrySizeRes.length;
          const entryEnd = Math.min(tracksEnd, entryStart + entrySizeRes.value);

          if (entryIdRes.id === 0xae) { // TrackEntry (0xAE)
            parseTrackEntry(bytes, entryStart, entryEnd, {
              videoTracks,
              audioTracks,
              subtitleTracks,
            });
          }
          cur = entryEnd;
        }
      }
    }
  }

  return {
    container: 'Matroska / WebM (MKV)',
    containerFullName: 'Matroska Video Container (.mkv / .webm)',
    duration,
    videoTracks,
    audioTracks,
    subtitleTracks,
  };
}

function parseTrackEntry(
  bytes: Uint8Array,
  start: number,
  end: number,
  out: {
    videoTracks: VideoTrackInfo[];
    audioTracks: AudioTrackInfo[];
    subtitleTracks: SubtitleTrackInfo[];
  }
) {
  let cur = start;
  let trackNumber = 1;
  let trackType = 1; // 1 = video, 2 = audio, 17 = subtitle
  let codecId = '';
  let name = '';
  let language = 'und';
  let width = 1920;
  let height = 1080;
  let channels = 2;
  let sampleRate = 48000;

  function readId(offset: number) {
    if (offset >= bytes.length) return null;
    const b0 = bytes[offset];
    let mask = 0x80;
    let len = 1;
    while (len <= 4 && !(b0 & mask)) {
      mask >>= 1;
      len++;
    }
    if (len > 4) return null;
    let id = 0;
    for (let i = 0; i < len; i++) {
      if (offset + i >= bytes.length) return null;
      id = (id << 8) | bytes[offset + i];
    }
    return { id, length: len };
  }

  function readVint(offset: number) {
    if (offset >= bytes.length) return null;
    const b0 = bytes[offset];
    let mask = 0x80;
    let len = 1;
    while (len <= 8 && !(b0 & mask)) {
      mask >>= 1;
      len++;
    }
    if (len > 8) return null;
    let val = b0 & (mask - 1);
    for (let i = 1; i < len; i++) {
      if (offset + i >= bytes.length) return null;
      val = (val << 8) | bytes[offset + i];
    }
    return { value: val, length: len };
  }

  while (cur < end) {
    const idRes = readId(cur);
    if (!idRes) break;
    const sizeRes = readVint(cur + idRes.length);
    if (!sizeRes) break;
    const elemStart = cur + idRes.length + sizeRes.length;
    const elemEnd = Math.min(end, elemStart + sizeRes.value);
    const elemSize = sizeRes.value;

    if (idRes.id === 0xd7) { // TrackNumber
      trackNumber = readUint(bytes, elemStart, elemSize);
    } else if (idRes.id === 0x83) { // TrackType
      trackType = readUint(bytes, elemStart, elemSize);
    } else if (idRes.id === 0x86) { // CodecID
      codecId = readAscii(bytes, elemStart, elemSize);
    } else if (idRes.id === 0x536e) { // Name
      name = readUtf8(bytes, elemStart, elemSize);
    } else if (idRes.id === 0x22b59c) { // Language
      language = readAscii(bytes, elemStart, elemSize);
    } else if (idRes.id === 0xe0) { // Video Settings
      let vCur = elemStart;
      while (vCur < elemEnd) {
        const vId = readId(vCur);
        if (!vId) break;
        const vSize = readVint(vCur + vId.length);
        if (!vSize) break;
        const vStart = vCur + vId.length + vSize.length;
        if (vId.id === 0xb0) width = readUint(bytes, vStart, vSize.value); // PixelWidth
        if (vId.id === 0xba) height = readUint(bytes, vStart, vSize.value); // PixelHeight
        vCur = vStart + vSize.value;
      }
    } else if (idRes.id === 0xe1) { // Audio Settings
      let aCur = elemStart;
      while (aCur < elemEnd) {
        const aId = readId(aCur);
        if (!aId) break;
        const aSize = readVint(aCur + aId.length);
        if (!aSize) break;
        const aStart = aCur + aId.length + aSize.length;
        if (aId.id === 0x9f) channels = readUint(bytes, aStart, aSize.value); // Channels
        if (aId.id === 0xb5) sampleRate = Math.round(readFloat(bytes, aStart, aSize.value)); // SamplingFrequency
        aCur = aStart + aSize.value;
      }
    }

    cur = elemEnd;
  }

  const cleanCodec = mapMkvCodec(codecId);

  if (trackType === 1) { // Video
    out.videoTracks.push({
      id: trackNumber,
      codec: cleanCodec.shortName,
      codecFullName: cleanCodec.fullName,
      width,
      height,
      isSupportedByBrowser: checkVideoCodecSupport(cleanCodec.shortName, width, height),
    });
  } else if (trackType === 2) { // Audio
    out.audioTracks.push({
      id: trackNumber,
      trackNumber: out.audioTracks.length + 1,
      codec: cleanCodec.shortName,
      codecFullName: cleanCodec.fullName,
      title: name || `Audio Track ${out.audioTracks.length + 1} (${getLanguageName(language)})`,
      language,
      languageLabel: getLanguageName(language),
      channels,
      channelsDescription: formatChannels(channels),
      sampleRate: sampleRate || 48000,
      isSupportedByBrowser: checkAudioCodecSupport(cleanCodec.shortName),
      isDefault: out.audioTracks.length === 0,
    });
  } else if (trackType === 17) { // Subtitle
    out.subtitleTracks.push({
      id: trackNumber,
      trackNumber: out.subtitleTracks.length + 1,
      codec: cleanCodec.shortName,
      title: name || `Subtitle Track ${out.subtitleTracks.length + 1} (${getLanguageName(language)})`,
      language,
      languageLabel: getLanguageName(language),
      isDefault: out.subtitleTracks.length === 0,
    });
  }
}

function mapMkvCodec(codecId: string): { shortName: string; fullName: string } {
  const c = codecId.toUpperCase();
  if (c.includes('AVC') || c.includes('H264')) return { shortName: 'H.264', fullName: 'H.264 / AVC Video' };
  if (c.includes('HEVC') || c.includes('H265')) return { shortName: 'H.265 / HEVC', fullName: 'H.265 / HEVC (High Efficiency Video Coding)' };
  if (c.includes('VP9')) return { shortName: 'VP9', fullName: 'Google VP9 Video' };
  if (c.includes('VP8')) return { shortName: 'VP8', fullName: 'Google VP8 Video' };
  if (c.includes('AV1')) return { shortName: 'AV1', fullName: 'AOMedia Video 1 (AV1)' };
  if (c.includes('AAC')) return { shortName: 'AAC', fullName: 'Advanced Audio Coding (AAC)' };
  if (c.includes('AC3')) return { shortName: 'AC-3', fullName: 'Dolby Digital AC-3 (5.1 Surround)' };
  if (c.includes('EAC3')) return { shortName: 'E-AC-3', fullName: 'Dolby Digital Plus (E-AC-3)' };
  if (c.includes('DTS')) return { shortName: 'DTS', fullName: 'DTS Digital Surround Sound' };
  if (c.includes('OPUS')) return { shortName: 'Opus', fullName: 'Opus Audio' };
  if (c.includes('VORBIS')) return { shortName: 'Vorbis', fullName: 'Ogg Vorbis Audio' };
  if (c.includes('FLAC')) return { shortName: 'FLAC', fullName: 'Free Lossless Audio Codec (FLAC)' };
  if (c.includes('PCM')) return { shortName: 'PCM', fullName: 'Pulse Code Modulation (Uncompressed)' };
  if (c.includes('MPEG/L3') || c.includes('MP3')) return { shortName: 'MP3', fullName: 'MPEG-1 Layer 3 Audio' };
  if (c.includes('UTF8') || c.includes('SRT')) return { shortName: 'SRT', fullName: 'SubRip Text Subtitles' };
  if (c.includes('ASS') || c.includes('SSA')) return { shortName: 'ASS', fullName: 'Advanced SubStation Alpha Subtitles' };
  return { shortName: codecId || 'Unknown', fullName: codecId || 'Unknown Codec' };
}

function readUint(bytes: Uint8Array, start: number, length: number): number {
  let val = 0;
  for (let i = 0; i < length && start + i < bytes.length; i++) {
    val = (val << 8) | bytes[start + i];
  }
  return val;
}

function readFloat(bytes: Uint8Array, start: number, length: number): number {
  if (length === 4) {
    const buf = new ArrayBuffer(4);
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < 4; i++) u8[i] = bytes[start + 3 - i];
    return new Float32Array(buf)[0];
  } else if (length === 8) {
    const buf = new ArrayBuffer(8);
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < 8; i++) u8[i] = bytes[start + 7 - i];
    return new Float64Array(buf)[0];
  }
  return 0;
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  let str = '';
  for (let i = 0; i < length && start + i < bytes.length; i++) {
    const c = bytes[start + i];
    if (c >= 32 && c <= 126) str += String.fromCharCode(c);
  }
  return str.trim();
}

function readUtf8(bytes: Uint8Array, start: number, length: number): string {
  try {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes.subarray(start, start + length)).trim();
  } catch {
    return readAscii(bytes, start, length);
  }
}

// ----------------------------------------------------
// Master Inspect Function
// ----------------------------------------------------
export async function inspectMediaFile(file: File): Promise<MediaInfo> {
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  let parsed: Partial<MediaInfo> = {};

  try {
    if (['mp4', 'm4v', 'mov', '3gp', 'm4a'].includes(extension)) {
      parsed = await parseMp4(file);
    } else if (['mkv', 'webm'].includes(extension)) {
      parsed = await parseMatroska(file);
    }
  } catch {
    // Fallback if binary parsing encountered unexpected chunk structure
  }

  const videoTracks = parsed.videoTracks || [];
  const audioTracks = parsed.audioTracks || [];
  const subtitleTracks = parsed.subtitleTracks || [];

  // If container parser didn't find specific tracks, synthesize sensible defaults based on extension
  if (!videoTracks.length) {
    const isMkv = ['mkv'].includes(extension);
    const isWebm = ['webm'].includes(extension);
    const isAvi = ['avi'].includes(extension);
    const isTs = ['ts', 'm2ts', 'mts'].includes(extension);

    videoTracks.push({
      id: 1,
      codec: isWebm ? 'VP9' : isMkv ? 'H.264 / HEVC' : isAvi ? 'MPEG-4 / Xvid' : isTs ? 'MPEG-2 / H.264' : 'H.264 / AVC',
      codecFullName: isWebm ? 'Google VP9' : isMkv ? 'Matroska Video Stream' : isAvi ? 'AVI Video Stream' : isTs ? 'MPEG Transport Stream' : 'AVC / H.264 Video',
      width: 1920,
      height: 1080,
      isSupportedByBrowser: !isAvi && !isTs,
    });
  }

  if (!audioTracks.length) {
    audioTracks.push({
      id: 1,
      trackNumber: 1,
      codec: extension === 'webm' ? 'Opus' : 'AAC',
      codecFullName: extension === 'webm' ? 'Opus Audio' : 'AAC LC (Stereo)',
      title: 'Default Audio Track',
      language: 'und',
      languageLabel: 'Default',
      channels: 2,
      channelsDescription: 'Stereo (2.0)',
      sampleRate: 48000,
      isSupportedByBrowser: true,
      isDefault: true,
    });
  }

  const unsupportedReasons: string[] = [];
  videoTracks.forEach((t) => {
    if (!t.isSupportedByBrowser) {
      unsupportedReasons.push(`Video stream codec (${t.codec}) is not natively playable by this browser.`);
    }
  });

  const supportedAudio = audioTracks.filter((t) => t.isSupportedByBrowser);
  if (audioTracks.length > 0 && supportedAudio.length === 0) {
    unsupportedReasons.push('Audio codecs in this file require VLC or external hardware decoders.');
  }

  const isFullySupportedNatively = unsupportedReasons.length === 0;

  return {
    container: parsed.container || extension.toUpperCase() + ' Container',
    containerFullName: parsed.containerFullName || `${extension.toUpperCase()} Media Container`,
    fileSize: file.size,
    duration: parsed.duration,
    videoTracks,
    audioTracks,
    subtitleTracks,
    hasMultiAudio: audioTracks.length > 1,
    isFullySupportedNatively,
    unsupportedReasons,
  };
}

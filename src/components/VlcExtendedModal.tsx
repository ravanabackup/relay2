import { useState, useRef, type ChangeEvent } from 'react';
import { motion } from 'motion/react';
import {
  X, Sliders, Volume2, Video, Subtitles, Info,
  RotateCcw, Sparkles, Upload, Music
} from 'lucide-react';
import {
  globalAudioEngine,
  EQ_FREQUENCIES,
  VLC_EQ_PRESETS,
  type EqPresetName,
  type StereoMode,
  type AudioEngineState
} from '../lib/audioEngine';
import type { MediaInfo } from '../lib/mediaParser';
import { parseSubtitleFile, type SubtitleCue } from '../lib/subtitleEngine';
import { formatBytes } from '../lib/utils';
import { VlcIcon } from './Brand';

export interface VideoFilterSettings {
  brightness: number; // 0 to 200, default 100
  contrast: number;   // 0 to 200, default 100
  saturation: number; // 0 to 200, default 100
  hue: number;        // 0 to 360, default 0
  gamma: number;      // 0.2 to 2.5, default 1.0
  invert: number;     // 0 to 100, default 0
  sepia: number;      // 0 to 100, default 0
  rotation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  aspectRatio: 'default' | '16:9' | '4:3' | '21:9' | '1:1' | 'fill';
}

export const DEFAULT_VIDEO_FILTERS: VideoFilterSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  gamma: 1.0,
  invert: 0,
  sepia: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  aspectRatio: 'default',
};

interface VlcExtendedModalProps {
  onClose: () => void;
  mediaInfo: MediaInfo | null;
  audioState: AudioEngineState;
  videoFilters: VideoFilterSettings;
  onUpdateFilters: (filters: VideoFilterSettings) => void;
  subtitleDelayMs: number;
  onUpdateSubtitleDelay: (delay: number) => void;
  subtitleFontSize: 'small' | 'medium' | 'large' | 'xlarge';
  onUpdateSubtitleFontSize: (size: 'small' | 'medium' | 'large' | 'xlarge') => void;
  onLoadSubtitles: (cues: SubtitleCue[], name: string) => void;
  activeSubtitleName: string;
}

export function VlcExtendedModal({
  onClose,
  mediaInfo,
  audioState,
  videoFilters,
  onUpdateFilters,
  subtitleDelayMs,
  onUpdateSubtitleDelay,
  subtitleFontSize,
  onUpdateSubtitleFontSize,
  onLoadSubtitles,
  activeSubtitleName,
}: VlcExtendedModalProps) {
  const [activeTab, setActiveTab] = useState<'audio' | 'tracks' | 'video' | 'subtitles' | 'codecs'>('audio');
  const subInputRef = useRef<HTMLInputElement>(null);

  const resetAudio = () => {
    globalAudioEngine.setPreset('Flat');
    globalAudioEngine.setPreamp(0);
    globalAudioEngine.setAudioDelayMs(0);
    globalAudioEngine.setStereoMode('stereo');
  };

  const resetVideo = () => {
    onUpdateFilters(DEFAULT_VIDEO_FILTERS);
  };

  const handleSubUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const cues = parseSubtitleFile(text, file.name);
      onLoadSubtitles(cues, file.name);
    } catch {
      // Failed to parse
    }
  };

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="vlc-extended-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vlc-modal-title"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vlc-modal-header">
          <div className="vlc-modal-title">
            <span className="vlc-cone-icon">
              <VlcIcon size={20} />
            </span>
            <div>
              <h2 id="vlc-modal-title">VLC Adjustments & Codec Controls</h2>
              <p>Audio Equalizer, Multi-Track Audio, Video Filters & Stream Inspector</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        <div className="vlc-modal-tabs" role="tablist">
          <button
            className={activeTab === 'audio' ? 'active' : ''}
            onClick={() => setActiveTab('audio')}
          >
            <Sliders size={15} /> Equalizer & Audio
          </button>
          <button
            className={activeTab === 'tracks' ? 'active' : ''}
            onClick={() => setActiveTab('tracks')}
          >
            <Music size={15} /> Audio Tracks ({mediaInfo?.audioTracks.length || 1})
          </button>
          <button
            className={activeTab === 'video' ? 'active' : ''}
            onClick={() => setActiveTab('video')}
          >
            <Video size={15} /> Video Filters
          </button>
          <button
            className={activeTab === 'subtitles' ? 'active' : ''}
            onClick={() => setActiveTab('subtitles')}
          >
            <Subtitles size={15} /> Subtitles
          </button>
          <button
            className={activeTab === 'codecs' ? 'active' : ''}
            onClick={() => setActiveTab('codecs')}
          >
            <Info size={15} /> Codec Information
          </button>
        </div>

        <div className="vlc-modal-body">
          {/* TAB 1: AUDIO EQUALIZER & DSP */}
          {activeTab === 'audio' && (
            <div className="eq-panel">
              <div className="eq-top-controls">
                <div className="eq-preset-picker">
                  <label htmlFor="eq-preset">EQUALIZER PRESET</label>
                  <select
                    id="eq-preset"
                    value={audioState.activePreset}
                    onChange={(e) => globalAudioEngine.setPreset(e.target.value as EqPresetName)}
                  >
                    {Object.keys(VLC_EQ_PRESETS).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="eq-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={audioState.isEqEnabled}
                      onChange={(e) => globalAudioEngine.setEqEnabled(e.target.checked)}
                    />
                    <span>Enable Equalizer</span>
                  </label>
                </div>

                <div className="eq-stereo-mode">
                  <label htmlFor="stereo-mode">STEREO MODE</label>
                  <select
                    id="stereo-mode"
                    value={audioState.stereoMode}
                    onChange={(e) => globalAudioEngine.setStereoMode(e.target.value as StereoMode)}
                  >
                    <option value="stereo">Original Stereo (2.0)</option>
                    <option value="mono">Mono Downmix (L + R)</option>
                    <option value="left">Left Channel Only</option>
                    <option value="right">Right Channel Only</option>
                    <option value="reverse">Reverse Stereo (R / L)</option>
                  </select>
                </div>

                <button className="button button-secondary eq-reset-btn" onClick={resetAudio}>
                  <RotateCcw size={14} /> Reset Audio
                </button>
              </div>

              {/* 10-BAND GRAPHIC EQUALIZER SLIDERS */}
              <div className="eq-sliders-container">
                {/* Preamp */}
                <div className="eq-slider-col preamp-col">
                  <span className="eq-val">{audioState.preampDb > 0 ? `+${audioState.preampDb.toFixed(1)}` : audioState.preampDb.toFixed(1)}dB</span>
                  <div className="eq-slider-track">
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      step="0.5"
                      value={audioState.preampDb}
                      onChange={(e) => globalAudioEngine.setPreamp(parseFloat(e.target.value))}
                      className="vertical-slider"
                    />
                  </div>
                  <span className="eq-freq">Preamp</span>
                </div>

                <div className="eq-divider" />

                {/* 10 Frequencies */}
                {EQ_FREQUENCIES.map((freq, i) => {
                  const db = audioState.bands[i] || 0;
                  return (
                    <div key={freq} className="eq-slider-col">
                      <span className="eq-val">{db > 0 ? `+${db.toFixed(1)}` : db.toFixed(1)}dB</span>
                      <div className="eq-slider-track">
                        <input
                          type="range"
                          min="-20"
                          max="20"
                          step="0.5"
                          value={db}
                          disabled={!audioState.isEqEnabled}
                          onChange={(e) => globalAudioEngine.setBand(i, parseFloat(e.target.value))}
                          className="vertical-slider"
                        />
                      </div>
                      <span className="eq-freq">{freq < 1000 ? `${freq}Hz` : `${freq / 1000}kHz`}</span>
                    </div>
                  );
                })}
              </div>

              {/* Audio Delay Sync & Boost */}
              <div className="audio-extra-controls">
                <div className="audio-delay-control">
                  <div className="audio-delay-header">
                    <label>AUDIO TRACK SYNCHRONIZATION (DELAY)</label>
                    <span className="delay-badge">{audioState.audioDelayMs > 0 ? `+${audioState.audioDelayMs}ms` : `${audioState.audioDelayMs}ms`}</span>
                  </div>
                  <div className="delay-slider-row">
                    <button className="button button-secondary mini-btn" onClick={() => globalAudioEngine.setAudioDelayMs(audioState.audioDelayMs - 50)}>-50ms</button>
                    <input
                      type="range"
                      min="-1000"
                      max="2000"
                      step="10"
                      value={audioState.audioDelayMs}
                      onChange={(e) => globalAudioEngine.setAudioDelayMs(parseInt(e.target.value, 10))}
                    />
                    <button className="button button-secondary mini-btn" onClick={() => globalAudioEngine.setAudioDelayMs(audioState.audioDelayMs + 50)}>+50ms</button>
                    <button className="text-link" onClick={() => globalAudioEngine.setAudioDelayMs(0)}>Reset (0ms)</button>
                  </div>
                  <p className="vlc-hint">Fixes video/audio sync if sound is slightly ahead or behind video frames.</p>
                </div>

                <div className="volume-boost-card">
                  <div className="boost-header">
                    <Volume2 size={16} />
                    <span>VLC VOLUME BOOST</span>
                    <strong className="boost-percent">{audioState.volumePercent}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={audioState.volumePercent}
                    onChange={(e) => globalAudioEngine.setVolume(parseInt(e.target.value, 10))}
                    className="boost-slider"
                  />
                  <span className="boost-subtext">Up to 200% with automatic peak soft-limiter to prevent clipping distortion.</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AUDIO TRACKS SELECTION */}
          {activeTab === 'tracks' && (
            <div className="tracks-panel">
              <div className="tracks-intro">
                <div className="tracks-intro-text">
                  <h3>Audio Streams & Track Selection</h3>
                  <p>Choose which audio stream to play. Supports multi-language dubs, commentary tracks, and 5.1/7.1 surround sound.</p>
                </div>
                <span className="tracks-count-badge">
                  {mediaInfo?.audioTracks.length || 1} Audio Track{(mediaInfo?.audioTracks.length || 1) > 1 ? 's' : ''} Detected
                </span>
              </div>

              <div className="audio-track-list">
                {mediaInfo?.audioTracks.map((track, idx) => {
                  const isSelected = audioState.currentAudioTrack === idx;
                  return (
                    <div
                      key={track.id}
                      className={`audio-track-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => globalAudioEngine.selectAudioTrack(idx)}
                    >
                      <div className="track-radio">
                        <span className={`radio-dot ${isSelected ? 'active' : ''}`} />
                      </div>
                      <div className="track-details">
                        <div className="track-main-row">
                          <strong>{track.title}</strong>
                          <span className="track-codec-tag">{track.codec}</span>
                        </div>
                        <div className="track-sub-row">
                          <span>Language: <em>{track.languageLabel}</em></span>
                          <span>•</span>
                          <span>{track.channelsDescription}</span>
                          <span>•</span>
                          <span>{track.sampleRate ? `${(track.sampleRate / 1000).toFixed(1)} kHz` : '48.0 kHz'}</span>
                          {track.isSupportedByBrowser ? (
                            <span className="track-status-ok">Native Web Play</span>
                          ) : (
                            <span className="track-status-vlc">VLC / Web Audio Relay</span>
                          )}
                        </div>
                      </div>
                      {isSelected && <span className="active-pill">ACTIVE PLAYBACK</span>}
                    </div>
                  );
                })}
              </div>

              <div className="tracks-note">
                <Sparkles size={16} />
                <p>
                  <strong>Tip:</strong> In Chrome & Firefox, multi-track switching routes through our Web Audio DSP engine. For exotic multi-channel DTS-HD/E-AC-3 streams, the VLC Stream mode plays all tracks with 100% native bitstream decoding.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: VIDEO FILTERS & EFFECTS */}
          {activeTab === 'video' && (
            <div className="video-effects-panel">
              <div className="effects-grid">
                <div className="effect-group">
                  <div className="effect-label-row">
                    <label>BRIGHTNESS</label>
                    <span>{videoFilters.brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="180"
                    value={videoFilters.brightness}
                    onChange={(e) => onUpdateFilters({ ...videoFilters, brightness: parseInt(e.target.value, 10) })}
                  />
                </div>

                <div className="effect-group">
                  <div className="effect-label-row">
                    <label>CONTRAST</label>
                    <span>{videoFilters.contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="200"
                    value={videoFilters.contrast}
                    onChange={(e) => onUpdateFilters({ ...videoFilters, contrast: parseInt(e.target.value, 10) })}
                  />
                </div>

                <div className="effect-group">
                  <div className="effect-label-row">
                    <label>SATURATION</label>
                    <span>{videoFilters.saturation}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="250"
                    value={videoFilters.saturation}
                    onChange={(e) => onUpdateFilters({ ...videoFilters, saturation: parseInt(e.target.value, 10) })}
                  />
                </div>

                <div className="effect-group">
                  <div className="effect-label-row">
                    <label>HUE ROTATE</label>
                    <span>{videoFilters.hue}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={videoFilters.hue}
                    onChange={(e) => onUpdateFilters({ ...videoFilters, hue: parseInt(e.target.value, 10) })}
                  />
                </div>

                <div className="effect-group">
                  <div className="effect-label-row">
                    <label>GAMMA</label>
                    <span>{videoFilters.gamma.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="2.2"
                    step="0.05"
                    value={videoFilters.gamma}
                    onChange={(e) => onUpdateFilters({ ...videoFilters, gamma: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="effect-group">
                  <div className="effect-label-row">
                    <label>SEPIA</label>
                    <span>{videoFilters.sepia}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={videoFilters.sepia}
                    onChange={(e) => onUpdateFilters({ ...videoFilters, sepia: parseInt(e.target.value, 10) })}
                  />
                </div>
              </div>

              {/* Geometry & Orientation */}
              <div className="geometry-section">
                <h4>VIDEO GEOMETRY & ASPECT RATIO</h4>
                <div className="geometry-row">
                  <div className="aspect-select">
                    <label>ASPECT RATIO</label>
                    <select
                      value={videoFilters.aspectRatio}
                      onChange={(e) => onUpdateFilters({ ...videoFilters, aspectRatio: e.target.value as VideoFilterSettings['aspectRatio'] })}
                    >
                      <option value="default">Original Aspect (Default)</option>
                      <option value="16:9">16:9 (Widescreen)</option>
                      <option value="4:3">4:3 (Standard TV)</option>
                      <option value="21:9">21:9 (Cinematic Ultrawide)</option>
                      <option value="1:1">1:1 (Square)</option>
                      <option value="fill">Fill / Stretch Window</option>
                    </select>
                  </div>

                  <div className="rotation-buttons">
                    <label>ROTATION & FLIP</label>
                    <div className="btn-group">
                      <button
                        className={`button button-secondary mini-btn ${videoFilters.rotation === 90 ? 'active' : ''}`}
                        onClick={() => onUpdateFilters({ ...videoFilters, rotation: ((videoFilters.rotation + 90) % 360) as VideoFilterSettings['rotation'] })}
                      >
                        Rotate 90° ({videoFilters.rotation}°)
                      </button>
                      <button
                        className={`button button-secondary mini-btn ${videoFilters.flipH ? 'active' : ''}`}
                        onClick={() => onUpdateFilters({ ...videoFilters, flipH: !videoFilters.flipH })}
                      >
                        Flip Horizontal
                      </button>
                      <button
                        className={`button button-secondary mini-btn ${videoFilters.flipV ? 'active' : ''}`}
                        onClick={() => onUpdateFilters({ ...videoFilters, flipV: !videoFilters.flipV })}
                      >
                        Flip Vertical
                      </button>
                    </div>
                  </div>

                  <button className="button button-secondary reset-video-btn" onClick={resetVideo}>
                    <RotateCcw size={14} /> Reset Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SUBTITLES */}
          {activeTab === 'subtitles' && (
            <div className="subtitles-panel">
              <div className="subs-header">
                <div>
                  <h3>Subtitles & Closed Captions</h3>
                  <p>Load external subtitle files or select embedded subtitle tracks.</p>
                </div>
                <input
                  ref={subInputRef}
                  type="file"
                  accept=".srt,.vtt,.ass,.ssa,.sub"
                  className="hidden-file-input"
                  onChange={handleSubUpload}
                />
                <button
                  className="button button-primary"
                  onClick={() => subInputRef.current?.click()}
                >
                  <Upload size={16} /> Load Subtitle File (.srt, .vtt, .ass)
                </button>
              </div>

              {activeSubtitleName && (
                <div className="active-sub-card">
                  <Subtitles size={18} />
                  <div>
                    <strong>Active Subtitle: {activeSubtitleName}</strong>
                    <span>Synchronized with video timeline</span>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => onLoadSubtitles([], '')}
                  >
                    Disable Subtitles
                  </button>
                </div>
              )}

              {/* Subtitle Delay Sync */}
              <div className="sub-delay-box">
                <div className="sub-delay-header">
                  <label>SUBTITLE DELAY SYNCHRONIZATION</label>
                  <span className="delay-badge">{subtitleDelayMs > 0 ? `+${subtitleDelayMs}ms` : `${subtitleDelayMs}ms`}</span>
                </div>
                <div className="delay-slider-row">
                  <button className="button button-secondary mini-btn" onClick={() => onUpdateSubtitleDelay(subtitleDelayMs - 100)}>-100ms</button>
                  <button className="button button-secondary mini-btn" onClick={() => onUpdateSubtitleDelay(subtitleDelayMs - 50)}>-50ms</button>
                  <input
                    type="range"
                    min="-5000"
                    max="5000"
                    step="50"
                    value={subtitleDelayMs}
                    onChange={(e) => onUpdateSubtitleDelay(parseInt(e.target.value, 10))}
                  />
                  <button className="button button-secondary mini-btn" onClick={() => onUpdateSubtitleDelay(subtitleDelayMs + 50)}>+50ms</button>
                  <button className="button button-secondary mini-btn" onClick={() => onUpdateSubtitleDelay(subtitleDelayMs + 100)}>+100ms</button>
                  <button className="text-link" onClick={() => onUpdateSubtitleDelay(0)}>Reset</button>
                </div>
              </div>

              {/* Subtitle Appearance */}
              <div className="sub-styling-box">
                <label>SUBTITLE FONT SIZE</label>
                <div className="size-buttons">
                  {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
                    <button
                      key={size}
                      className={`button button-secondary size-btn ${subtitleFontSize === size ? 'active' : ''}`}
                      onClick={() => onUpdateSubtitleFontSize(size)}
                    >
                      {size.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CODEC INFORMATION (VLC INSPECTOR) */}
          {activeTab === 'codecs' && (
            <div className="codec-info-panel">
              <div className="codec-section">
                <h3>CONTAINER & GENERAL STREAM INFO</h3>
                <div className="codec-info-grid">
                  <div className="codec-item">
                    <span>Container Format</span>
                    <strong>{mediaInfo?.containerFullName || 'ISO Media / Matroska'}</strong>
                  </div>
                  <div className="codec-item">
                    <span>File Size</span>
                    <strong>{mediaInfo ? formatBytes(mediaInfo.fileSize) : '--'}</strong>
                  </div>
                  <div className="codec-item">
                    <span>Browser Playability</span>
                    <strong className={mediaInfo?.isFullySupportedNatively ? 'text-green' : 'text-amber'}>
                      {mediaInfo?.isFullySupportedNatively ? 'Fully Supported Natively' : 'Multi-Track / VLC Streaming Mode'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Video Streams */}
              <div className="codec-section">
                <h3>VIDEO STREAM DETAILS</h3>
                {mediaInfo?.videoTracks.map((v, i) => (
                  <div key={v.id} className="stream-card">
                    <div className="stream-header">
                      <strong>Stream {i}: Video</strong>
                      <span className="codec-badge">{v.codec}</span>
                    </div>
                    <div className="stream-grid">
                      <div><span>Codec:</span> <strong>{v.codecFullName}</strong></div>
                      <div><span>Resolution:</span> <strong>{v.width} × {v.height}</strong></div>
                      <div><span>Browser Status:</span> <strong className={v.isSupportedByBrowser ? 'text-green' : 'text-amber'}>{v.isSupportedByBrowser ? 'Hardware Accelerated' : 'VLC Streaming Helper'}</strong></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Audio Streams */}
              <div className="codec-section">
                <h3>AUDIO STREAMS DETAILS ({mediaInfo?.audioTracks.length || 0})</h3>
                {mediaInfo?.audioTracks.map((a, i) => (
                  <div key={a.id} className="stream-card">
                    <div className="stream-header">
                      <strong>Stream {i + 1}: Audio ({a.title})</strong>
                      <span className="codec-badge">{a.codec}</span>
                    </div>
                    <div className="stream-grid">
                      <div><span>Codec:</span> <strong>{a.codecFullName}</strong></div>
                      <div><span>Channels:</span> <strong>{a.channelsDescription}</strong></div>
                      <div><span>Sampling Rate:</span> <strong>{a.sampleRate} Hz</strong></div>
                      <div><span>Language:</span> <strong>{a.languageLabel} ({a.language})</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="vlc-modal-footer">
          <span>VLC Media Engine • Real-time Web Audio DSP & Stream Processing</span>
          <button className="button button-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

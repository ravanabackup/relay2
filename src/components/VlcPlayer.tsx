import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type MouseEvent,
  type ChangeEvent,
  type RefObject,
} from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Sliders,
  FastForward,
  Rewind,
  Music,
  Subtitles,
  Gauge,
} from 'lucide-react';
import { formatDuration } from '../lib/utils';
import { globalAudioEngine, type AudioEngineState } from '../lib/audioEngine';
import type { MediaInfo } from '../lib/mediaParser';
import type { SubtitleCue } from '../lib/subtitleEngine';
import {
  VlcExtendedModal,
  type VideoFilterSettings,
  DEFAULT_VIDEO_FILTERS,
} from './VlcExtendedModal';

interface VlcPlayerProps {
  src: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  mediaInfo: MediaInfo | null;
  loop?: boolean;
  onEnded?: () => void;
  onError?: () => void;
  onLoadedMetadata?: () => void;
  onCanPlay?: () => void;
}

export function VlcPlayer({
  src,
  videoRef,
  mediaInfo,
  loop = true,
  onEnded,
  onError,
  onLoadedMetadata,
  onCanPlay,
}: VlcPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const subFileInputRef = useRef<HTMLInputElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [showRemainingTime, setShowRemainingTime] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExtendedModal, setShowExtendedModal] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | undefined>(undefined);

  // Audio Engine State
  const [audioState, setAudioState] = useState<AudioEngineState>(
    globalAudioEngine.getState()
  );

  // Video Filters State
  const [videoFilters, setVideoFilters] =
    useState<VideoFilterSettings>(DEFAULT_VIDEO_FILTERS);

  // Subtitles State
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeSubtitleName, setActiveSubtitleName] = useState('');
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');
  const [subtitleDelayMs, setSubtitleDelayMs] = useState(0);
  const [subtitleFontSize, setSubtitleFontSize] = useState<
    'small' | 'medium' | 'large' | 'xlarge'
  >('medium');

  // Popover menus
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [subMenuOpen, setSubMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);

  // Subscribe to Audio Engine changes
  useEffect(() => {
    const unsub = globalAudioEngine.subscribe((s) => setAudioState(s));
    return unsub;
  }, []);

  // Connect AudioEngine on video mount
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      globalAudioEngine.attach(video);
    }
  }, [videoRef, src]);

  // Handle Fullscreen change
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Auto-hide controls in fullscreen or playback
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    window.clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
        setAudioMenuOpen(false);
        setSubMenuOpen(false);
        setSpeedMenuOpen(false);
      }, 3500);
    }
  }, [isPlaying]);

  // Video timeupdate handler
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const cur = video.currentTime;
    setCurrentTime(cur);

    if (video.buffered.length > 0) {
      setBufferedEnd(video.buffered.end(video.buffered.length - 1));
    }

    // Update active subtitle cue
    if (subtitleCues.length > 0) {
      const adjustedTime = cur + subtitleDelayMs / 1000;
      const activeCue = subtitleCues.find(
        (c) => adjustedTime >= c.start && adjustedTime <= c.end
      );
      setCurrentSubtitleText(activeCue ? activeCue.text : '');
    } else {
      setCurrentSubtitleText('');
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
    resetControlsTimer();
  };

  const seek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, time));
    setCurrentTime(video.currentTime);
    resetControlsTimer();
  };

  const frameStep = (direction = 1) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    // Typical frame duration is ~1/30 or 1/24 sec
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + (direction * 1) / 30));
    resetControlsTimer();
  };

  const handleProgressBarClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    seek(pos * duration);
  };

  const toggleMute = () => {
    globalAudioEngine.setMuted(!audioState.isMuted);
    resetControlsTimer();
  };

  const changeVolume = (val: number) => {
    globalAudioEngine.setVolume(val);
    if (audioState.isMuted && val > 0) {
      globalAudioEngine.setMuted(false);
    }
    resetControlsTimer();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
    resetControlsTimer();
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setSpeedMenuOpen(false);
    resetControlsTimer();
  };

  // Keyboard shortcuts (VLC Standard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        frameStep(1);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seek(currentTime + (e.ctrlKey || e.metaKey ? 60 : e.shiftKey ? 3 : 5));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seek(currentTime - (e.ctrlKey || e.metaKey ? 60 : e.shiftKey ? 3 : 5));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        changeVolume(Math.min(200, audioState.volumePercent + 5));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        changeVolume(Math.max(0, audioState.volumePercent - 5));
      } else if (e.key === '[') {
        e.preventDefault();
        changePlaybackRate(Math.max(0.25, playbackRate - 0.25));
      } else if (e.key === ']') {
        e.preventDefault();
        changePlaybackRate(Math.min(4, playbackRate + 0.25));
      } else if (e.key === 'j') {
        e.preventDefault();
        globalAudioEngine.setAudioDelayMs(audioState.audioDelayMs - 50);
      } else if (e.key === 'k') {
        e.preventDefault();
        globalAudioEngine.setAudioDelayMs(audioState.audioDelayMs + 50);
      } else if (e.key === 'g') {
        e.preventDefault();
        setSubtitleDelayMs((d) => d - 50);
      } else if (e.key === 'h') {
        e.preventDefault();
        setSubtitleDelayMs((d) => d + 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleSubFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { parseSubtitleFile } = await import('../lib/subtitleEngine');
      const cues = parseSubtitleFile(text, file.name);
      setSubtitleCues(cues);
      setActiveSubtitleName(file.name);
      setSubMenuOpen(false);
    } catch {
      // ignore
    }
  };

  // Compute CSS filter style
  const filterStyle = `
    brightness(${videoFilters.brightness}%)
    contrast(${videoFilters.contrast}%)
    saturate(${videoFilters.saturation}%)
    hue-rotate(${videoFilters.hue}deg)
    invert(${videoFilters.invert}%)
    sepia(${videoFilters.sepia}%)
  `;

  // Compute transform style
  const transformStyle = `
    rotate(${videoFilters.rotation}deg)
    scaleX(${videoFilters.flipH ? -1 : 1})
    scaleY(${videoFilters.flipV ? -1 : 1})
  `;

  // Aspect ratio class
  const getAspectRatioClass = () => {
    switch (videoFilters.aspectRatio) {
      case '16:9': return 'aspect-16-9';
      case '4:3': return 'aspect-4-3';
      case '21:9': return 'aspect-21-9';
      case '1:1': return 'aspect-1-1';
      case 'fill': return 'aspect-fill';
      default: return 'aspect-default';
    }
  };

  const hasActiveEffects =
    audioState.isEqEnabled ||
    audioState.preampDb !== 0 ||
    audioState.volumePercent > 100 ||
    audioState.stereoMode !== 'stereo' ||
    audioState.audioDelayMs !== 0 ||
    videoFilters.brightness !== 100 ||
    videoFilters.contrast !== 100 ||
    videoFilters.saturation !== 100 ||
    videoFilters.hue !== 0 ||
    videoFilters.rotation !== 0 ||
    videoFilters.flipH ||
    videoFilters.flipV;

  return (
    <div
      ref={containerRef}
      className={`vlc-player-container ${isFullscreen ? 'is-fullscreen' : ''} ${
        showControls ? 'show-controls' : 'hide-controls'
      }`}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      {/* Video Surface */}
      <div className={`vlc-video-surface ${getAspectRatioClass()}`}>
        <video
          ref={videoRef}
          src={src}
          loop={loop}
          playsInline
          preload="auto"
          className="vlc-native-video"
          style={{
            filter: filterStyle,
            transform: transformStyle,
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
            }
            onLoadedMetadata?.();
          }}
          onCanPlay={onCanPlay}
          onEnded={() => {
            setIsPlaying(false);
            onEnded?.();
          }}
          onError={onError}
          onClick={togglePlay}
        />

        {/* Subtitle Display Overlay */}
        {currentSubtitleText && (
          <div className="vlc-subtitle-overlay">
            <span
              className={`vlc-subtitle-text size-${subtitleFontSize}`}
              dangerouslySetInnerHTML={{
                __html: currentSubtitleText.replace(/\n/g, '<br/>'),
              }}
            />
          </div>
        )}
      </div>

      {/* Hidden File Input for Subtitle loading */}
      <input
        ref={subFileInputRef}
        type="file"
        accept=".srt,.vtt,.ass,.ssa,.sub"
        className="hidden-file-input"
        onChange={handleSubFile}
      />

      {/* Control Overlay Bar */}
      <div className="vlc-controls-overlay" onClick={(e) => e.stopPropagation()}>
        {/* Progress Bar / Scrubber */}
        <div
          ref={progressBarRef}
          className="vlc-progress-track"
          onClick={handleProgressBarClick}
        >
          <div
            className="vlc-buffered-bar"
            style={{ width: `${(bufferedEnd / (duration || 1)) * 100}%` }}
          />
          <div
            className="vlc-played-bar"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          />
          <div
            className="vlc-scrubber-handle"
            style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
          />
        </div>

        {/* Buttons Toolbar */}
        <div className="vlc-toolbar-row">
          {/* Left Controls: Play/Pause, Frame Step, Skips */}
          <div className="vlc-tool-group left-group">
            <button
              className="vlc-tool-btn play-btn"
              onClick={togglePlay}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            </button>

            <button
              className="vlc-tool-btn"
              onClick={() => seek(currentTime - 10)}
              title="Jump Backward 10s (Left Arrow)"
            >
              <Rewind size={15} />
            </button>

            <button
              className="vlc-tool-btn"
              onClick={() => seek(currentTime + 10)}
              title="Jump Forward 10s (Right Arrow)"
            >
              <FastForward size={15} />
            </button>

            <button
              className="vlc-tool-btn"
              onClick={() => frameStep(1)}
              title="Frame Step / Next Frame (E)"
            >
              <span className="frame-step-text">STEP</span>
            </button>

            {/* Time Counter */}
            <div
              className="vlc-time-counter"
              onClick={() => setShowRemainingTime(!showRemainingTime)}
              title="Click to toggle remaining time"
            >
              <span>{formatDuration(currentTime)}</span>
              <span className="time-sep">/</span>
              <span>
                {showRemainingTime
                  ? `-${formatDuration(Math.max(0, duration - currentTime))}`
                  : formatDuration(duration)}
              </span>
            </div>
          </div>

          {/* Right Controls: Volume Boost, Audio Tracks, Subs, Speed, Effects, Fullscreen */}
          <div className="vlc-tool-group right-group">
            {/* Volume Control with 200% Booster */}
            <div className="vlc-volume-wrapper">
              <button
                className={`vlc-tool-btn volume-btn ${audioState.isMuted ? 'muted' : ''}`}
                onClick={toggleMute}
                title="Mute / Unmute (M)"
              >
                {audioState.isMuted || audioState.volumePercent === 0 ? (
                  <VolumeX size={16} />
                ) : audioState.volumePercent > 100 ? (
                  <Volume2 size={16} className="text-amber-glow" />
                ) : audioState.volumePercent > 50 ? (
                  <Volume2 size={16} />
                ) : (
                  <Volume1 size={16} />
                )}
              </button>

              <div className="vlc-volume-slider-box">
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={audioState.isMuted ? 0 : audioState.volumePercent}
                  onChange={(e) => changeVolume(parseInt(e.target.value, 10))}
                  className={`vlc-volume-slider ${
                    audioState.volumePercent > 100 ? 'boosted' : ''
                  }`}
                />
                <span className="volume-percent-label">
                  {audioState.isMuted ? '0%' : `${audioState.volumePercent}%`}
                </span>
              </div>
            </div>

            {/* Audio Track Quick Picker */}
            <div className="vlc-popover-wrapper">
              <button
                className={`vlc-tool-btn ${audioMenuOpen ? 'active' : ''}`}
                onClick={() => {
                  setAudioMenuOpen(!audioMenuOpen);
                  setSubMenuOpen(false);
                  setSpeedMenuOpen(false);
                }}
                title="Audio Tracks & Streams"
              >
                <Music size={15} />
                <span className="mini-badge">{audioState.currentAudioTrack + 1}</span>
              </button>

              {audioMenuOpen && (
                <div className="vlc-popover-menu">
                  <div className="popover-title">AUDIO TRACK SELECTION</div>
                  {mediaInfo?.audioTracks.map((track, i) => (
                    <button
                      key={track.id}
                      className={`popover-item ${
                        audioState.currentAudioTrack === i ? 'is-selected' : ''
                      }`}
                      onClick={() => {
                        globalAudioEngine.selectAudioTrack(i);
                        setAudioMenuOpen(false);
                      }}
                    >
                      <span>{track.title}</span>
                      <span className="codec-subtag">{track.codec}</span>
                    </button>
                  ))}
                  <div className="popover-divider" />
                  <button
                    className="popover-item"
                    onClick={() => {
                      setShowExtendedModal(true);
                      setAudioMenuOpen(false);
                    }}
                  >
                    <Sliders size={13} />
                    <span>Audio Equalizer & Sync...</span>
                  </button>
                </div>
              )}
            </div>

            {/* Subtitle Track Quick Picker */}
            <div className="vlc-popover-wrapper">
              <button
                className={`vlc-tool-btn ${activeSubtitleName ? 'has-sub' : ''} ${
                  subMenuOpen ? 'active' : ''
                }`}
                onClick={() => {
                  setSubMenuOpen(!subMenuOpen);
                  setAudioMenuOpen(false);
                  setSpeedMenuOpen(false);
                }}
                title="Subtitles & Closed Captions"
              >
                <Subtitles size={15} />
              </button>

              {subMenuOpen && (
                <div className="vlc-popover-menu">
                  <div className="popover-title">SUBTITLES</div>
                  <button
                    className={`popover-item ${!activeSubtitleName ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSubtitleCues([]);
                      setActiveSubtitleName('');
                      setSubMenuOpen(false);
                    }}
                  >
                    <span>Subtitles Off</span>
                  </button>
                  {mediaInfo?.subtitleTracks.map((sub, idx) => (
                    <button
                      key={sub.id}
                      className={`popover-item ${
                        activeSubtitleName === sub.title ? 'is-selected' : ''
                      }`}
                      onClick={() => {
                        setActiveSubtitleName(sub.title);
                        setSubMenuOpen(false);
                      }}
                    >
                      <span>Track {idx + 1}: {sub.title}</span>
                    </button>
                  ))}
                  <div className="popover-divider" />
                  <button
                    className="popover-item"
                    onClick={() => subFileInputRef.current?.click()}
                  >
                    <span>Load Subtitle File (.srt, .vtt)...</span>
                  </button>
                </div>
              )}
            </div>

            {/* Playback Speed */}
            <div className="vlc-popover-wrapper">
              <button
                className={`vlc-tool-btn speed-btn ${speedMenuOpen ? 'active' : ''}`}
                onClick={() => {
                  setSpeedMenuOpen(!speedMenuOpen);
                  setAudioMenuOpen(false);
                  setSubMenuOpen(false);
                }}
                title="Playback Speed"
              >
                <Gauge size={14} />
                <span>{playbackRate}x</span>
              </button>

              {speedMenuOpen && (
                <div className="vlc-popover-menu speed-menu">
                  <div className="popover-title">PLAYBACK SPEED</div>
                  {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 4.0].map((rate) => (
                    <button
                      key={rate}
                      className={`popover-item ${playbackRate === rate ? 'is-selected' : ''}`}
                      onClick={() => changePlaybackRate(rate)}
                    >
                      <span>{rate}x</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Extended Controls / Codec Inspector Button */}
            <button
              className={`vlc-tool-btn effects-btn ${hasActiveEffects ? 'effects-active' : ''}`}
              onClick={() => setShowExtendedModal(true)}
              title="VLC Extended Controls & Equalizer"
            >
              <Sliders size={15} />
              {hasActiveEffects && <span className="effects-dot" />}
            </button>

            {/* Fullscreen Button */}
            <button
              className="vlc-tool-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* VLC Extended Modal Dialog */}
      {showExtendedModal && (
        <VlcExtendedModal
          onClose={() => setShowExtendedModal(false)}
          mediaInfo={mediaInfo}
          audioState={audioState}
          videoFilters={videoFilters}
          onUpdateFilters={setVideoFilters}
          subtitleDelayMs={subtitleDelayMs}
          onUpdateSubtitleDelay={setSubtitleDelayMs}
          subtitleFontSize={subtitleFontSize}
          onUpdateSubtitleFontSize={setSubtitleFontSize}
          onLoadSubtitles={(cues, name) => {
            setSubtitleCues(cues);
            setActiveSubtitleName(name);
          }}
          activeSubtitleName={activeSubtitleName}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ArrowUpRight, BookOpen, Check, CircleAlert, CircleCheck, CodeXml, Copy, Download, FileVideo, FolderOpen, Info, Link2, LoaderCircle, LockKeyhole, Monitor, ShieldCheck, Sliders, Square, X } from 'lucide-react';
import { Brand, VlcIcon } from './components/Brand';
import { GuideModal, type GuideTab } from './components/GuideModal';
import { WatchView } from './components/WatchView';
import { VlcPlayer } from './components/VlcPlayer';
import { VlcExtendedModal, DEFAULT_VIDEO_FILTERS, type VideoFilterSettings } from './components/VlcExtendedModal';
import { useHostStream } from './hooks/useHostStream';
import { copyText, downloadText, formatBytes, formatDuration, isHttpUrl, readWatchLink } from './lib/utils';
import { inspectMediaFile, type MediaInfo } from './lib/mediaParser';
import { globalAudioEngine, type AudioEngineState } from './lib/audioEngine';
import type { SubtitleCue } from './lib/subtitleEngine';

type Toast = { message: string; kind: 'success' | 'error'; id: number };

function UploadIllustration() {
  return (
    <svg className="upload-illustration" width="104" height="88" viewBox="0 0 104 88" fill="none" aria-hidden="true">
      <path d="M14 14h12M14 14v12M90 64H78M90 64V52" stroke="#E3DBD1" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="34" y="11" width="51" height="55" rx="8" transform="rotate(12 34 11)" fill="#FFF2E8" stroke="#F1C6AC" strokeWidth="1.5" />
      <rect x="22" y="24" width="57" height="44" rx="8" fill="#FFFDF9" stroke="#ED8858" strokeWidth="1.7" />
      <path d="m46 36 15 10-15 10V36Z" fill="#ED8858" />
      <path d="M30 29v5M30 58v5M71 29v5M71 58v5" stroke="#EFCBB5" strokeWidth="2" strokeLinecap="round" />
      <path d="M44 78h19" stroke="#E9E2D9" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState('');
  const [duration, setDuration] = useState(Number.NaN);
  const [ready, setReady] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loop, setLoop] = useState(true);
  const [mode, setMode] = useState<'browser' | 'vlc'>('browser');
  const [vlcUrl, setVlcUrl] = useState('');
  const [guide, setGuide] = useState<GuideTab | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [copied, setCopied] = useState(false);
  const [watch, setWatch] = useState(readWatchLink);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [showVlcEffects, setShowVlcEffects] = useState(false);
  const [audioState, setAudioState] = useState<AudioEngineState>(globalAudioEngine.getState());
  const [videoFilters, setVideoFilters] = useState<VideoFilterSettings>(DEFAULT_VIDEO_FILTERS);
  const [, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeSubtitleName, setActiveSubtitleName] = useState('');
  const [subtitleDelayMs, setSubtitleDelayMs] = useState(0);
  const [subtitleFontSize, setSubtitleFontSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium');

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const urlRef = useRef('');
  const autoStartRef = useRef(false);
  const dragDepth = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const copyTimer = useRef<number | undefined>(undefined);
  const toastId = useRef(0);

  useEffect(() => {
    const unsub = globalAudioEngine.subscribe((s) => setAudioState(s));
    return unsub;
  }, []);

  const notify = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, kind, id: ++toastId.current });
    toastTimer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 6500 : 3500);
  }, []);
  const host = useHostStream(videoRef, notify);
  const closeGuide = useCallback(() => setGuide(null), []);
  const openGuide = useCallback((tab: GuideTab) => setGuide(tab), []);

  useEffect(() => {
    const onHashChange = () => {
      const session = readWatchLink();
      if (session) host.stop();
      setWatch(session);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [host.stop]);

  useEffect(() => {
    const input = inputRef.current;
    const onCancel = () => { autoStartRef.current = false; };
    input?.addEventListener('cancel', onCancel);
    return () => input?.removeEventListener('cancel', onCancel);
  }, [watch]);

  useEffect(() => {
    const preventFileNavigation = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', preventFileNavigation);
    window.addEventListener('drop', preventFileNavigation);
    return () => {
      window.removeEventListener('dragover', preventFileNavigation);
      window.removeEventListener('drop', preventFileNavigation);
    };
  }, []);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    window.clearTimeout(toastTimer.current);
    window.clearTimeout(copyTimer.current);
  }, []);

  const goHome = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setWatch(null);
  };

  const chooseFile = (autoStart = false) => {
    autoStartRef.current = autoStart;
    inputRef.current?.click();
  };

  const loadFile = (next: File) => {
    if (!next.size) {
      autoStartRef.current = false;
      notify('This file is empty. Choose a video with playable content.', 'error');
      return;
    }
    if (!next.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v|ogv|ogg|mkv|avi|mpeg|mpg|ts|m2ts)$/i.test(next.name)) {
      autoStartRef.current = false;
      notify('That does not look like a video. Choose an MP4, WebM, MOV, or another video file.', 'error');
      return;
    }
    host.stop();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(next);
    setFile(next);
    setObjectUrl(urlRef.current);
    setDuration(Number.NaN);
    setReady(false);
    setVideoError('');
    setCopied(false);
    setVlcUrl('');
    if (inputRef.current) inputRef.current.value = '';

    // Inspect container, all audio tracks, codecs, and subtitles
    void inspectMediaFile(next).then((info) => {
      setMediaInfo(info);
      if (info.hasMultiAudio) {
        notify(`Detected ${info.audioTracks.length} audio tracks. Use the VLC track picker to switch tracks.`, 'success');
      }
    });
  };

  const removeFile = () => {
    const wasLive = host.status === 'live';
    host.stop();
    autoStartRef.current = false;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = '';
    setFile(null);
    setMediaInfo(null);
    setObjectUrl('');
    setReady(false);
    setVideoError('');
    setDuration(Number.NaN);
    setSubtitleCues([]);
    setActiveSubtitleName('');
    if (wasLive) notify('Video removed. Your stream has stopped.');
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    autoStartRef.current = false;
    const next = event.dataTransfer.files[0];
    if (next) loadFile(next);
  };

  const startOrStop = () => {
    if (host.status === 'live') {
      host.stop();
      notify('Sharing stopped. Your previous link is no longer active.');
    } else if (!file) {
      chooseFile(true);
    } else if (videoError) {
      setMode('vlc');
      setGuide('vlc');
    } else if (ready) {
      void host.start(file);
    } else {
      notify('Your video is still loading. Please try again in a moment.', 'error');
    }
  };

  const copyLink = async () => {
    const link = mode === 'browser' ? host.link : vlcUrl.trim();
    if (!link || (mode === 'vlc' && !isHttpUrl(link))) return;
    try {
      await copyText(link);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
      notify('Link copied. A good video deserves company.');
    } catch {
      notify('Clipboard access was blocked. Select the URL and copy it manually.', 'error');
    }
  };

  const importVlc = (url: string) => {
    if (!isHttpUrl(url)) return false;
    setVlcUrl(url);
    setMode('vlc');
    if (watch) goHome();
    notify('VLC link added. Keep the local helper running on your source device.');
    return true;
  };

  const downloadPlaylist = () => {
    if (!isHttpUrl(vlcUrl)) return;
    const name = (file?.name || 'Relay video stream').replace(/[\r\n]/g, ' ');
    downloadText(`#EXTM3U\n#EXTINF:-1,${name}\n${new URL(vlcUrl.trim()).href}\n`, 'relay-stream.m3u', 'audio/x-mpegurl');
    notify('Playlist downloaded. Open it in VLC to play the source stream.');
  };

  const isLive = host.status === 'live';
  const isConnecting = host.status === 'connecting';
  const hasVlcLink = isHttpUrl(vlcUrl);
  const canCopy = mode === 'browser' ? Boolean(host.link) : hasVlcLink;

  return (
    <MotionConfig reducedMotion="user">
      {watch ? <WatchView session={watch} onBack={goHome} onGuide={openGuide} /> : <div className="app-shell">
        <motion.header className="site-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <div className="header-inner">
            <button className="brand-button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Relay home"><Brand /></button>
            <nav className="main-nav" aria-label="Main navigation">
              <button className="nav-active" onClick={() => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>New stream</button>
              <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button>
            </nav>
            <div className="header-right"><span className="header-local"><LockKeyhole size={14} /> Files stay with you</span><button className="header-guide" onClick={() => setGuide('start')}><BookOpen size={16} /> Setup guide <ArrowUpRight size={14} /></button></div>
          </div>
        </motion.header>

        <main className="main-container">
          <motion.div className="page-intro" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}>
            <div className="intro-kicker"><span className="kicker-line" /> LOCAL-FIRST VIDEO SHARING</div>
            <h1>Your video. <span>Just a link.</span></h1>
            <p>Stream straight from your device. No uploads. No cloud storage. All yours.</p>
          </motion.div>

          <motion.section id="workspace" className="workspace" aria-label="Create a video stream" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.18 }}>
            <div className="source-panel interactive-panel">
              <div className="panel-heading"><div className="panel-title"><span className="step-number">01</span><h2>Your video</h2></div>{file ? <button className="icon-button remove-source" onClick={removeFile} aria-label="Remove preview video and stop browser sharing" title="Remove video"><X size={18} /></button> : <span className="panel-meta">THE SOURCE</span>}</div>
              <div className="source-body">
                <input ref={inputRef} type="file" accept="video/*,.mkv,.avi,.m4v,.mov,.ogv,.ts,.m2ts" className="hidden-file-input" aria-label="Choose a video from your device" onChange={(event) => { const next = event.target.files?.[0]; if (next) loadFile(next); }} />
                <motion.div className={`upload-area${dragging ? ' is-dragging' : ''}${file ? ' has-video' : ''}`} animate={{ scale: dragging ? 1.012 : 1 }} transition={{ duration: 0.2 }} onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; setDragging(true); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }} onDrop={onDrop}>
                  {!file ? <div className="empty-source"><UploadIllustration /><h3>{dragging ? 'Drop it. Make it a moment.' : 'Drop your video here'}</h3><p>Good things are better when shared.</p><button className="button button-primary choose-button" onClick={() => chooseFile()}><FolderOpen size={17} /> Choose a video</button><span className="file-formats">MP4 <span /> WEBM <span /> MKV <span /> MOV <span /> & MORE</span></div> : <>
                    <VlcPlayer
                      key={objectUrl}
                      src={objectUrl}
                      videoRef={videoRef}
                      mediaInfo={mediaInfo}
                      loop={loop}
                      onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? Number.NaN)}
                      onCanPlay={() => {
                        setReady(true);
                        if (autoStartRef.current && mode === 'browser' && file) {
                          autoStartRef.current = false;
                          void host.start(file);
                        }
                      }}
                      onEnded={() => {
                        if (isLive || isConnecting) {
                          host.stop();
                          notify('The video ended. Create a new link to share it again.');
                        }
                      }}
                      onError={() => {
                        autoStartRef.current = false;
                        setReady(false);
                        if (isLive || isConnecting) host.stop();
                        setVideoError('This format or codec is not directly decoded by standard HTML5. Use the VLC helper to stream all tracks losslessly.');
                      }}
                    />
                    {videoError && <div className="video-error-state"><FileVideo size={38} strokeWidth={1.3} /><h3>This one needs the VLC streaming helper.</h3><p>{videoError}</p><button className="button button-secondary" onClick={() => { setMode('vlc'); setGuide('vlc'); }}><VlcIcon /> Use VLC instead <ArrowUpRight size={15} /></button></div>}
                    {dragging && <div className="drop-replace"><FolderOpen size={30} /><strong>Drop to replace your video</strong><span>Replacing the source ends the current browser stream.</span></div>}
                  </>}
                </motion.div>
                {file ? <>
                  <div className="selected-file">
                    <span className="selected-file-icon"><FileVideo size={21} /></span>
                    <div className="selected-file-detail">
                      <strong title={file.name}>{file.name}</strong>
                      <span>{formatBytes(file.size)} <i /> {formatDuration(duration)} <i /> {(file.name.split('.').pop() || 'VIDEO').toUpperCase()}</span>
                    </div>
                    <button className="change-file text-link" onClick={() => chooseFile()} title="Choose a different video">Change <ArrowUpRight size={13} /></button>
                  </div>

                  {/* Quick Codec & Audio Tracks Bar */}
                  {mediaInfo && (
                    <div className="quick-codec-bar">
                      <div className="quick-codec-tags">
                        <span className="quick-tag">{mediaInfo.container}</span>
                        {mediaInfo.videoTracks[0] && <span className="quick-tag">{mediaInfo.videoTracks[0].codec}</span>}
                        <span className="quick-tag audio-tag">
                          {mediaInfo.audioTracks.length} Audio Track{mediaInfo.audioTracks.length > 1 ? 's' : ''} ({mediaInfo.audioTracks.map((t) => t.codec).join(', ')})
                        </span>
                        {mediaInfo.subtitleTracks.length > 0 && (
                          <span className="quick-tag">{mediaInfo.subtitleTracks.length} Subtitles</span>
                        )}
                      </div>
                      <button className="text-link" onClick={() => setShowVlcEffects(true)}>
                        <Sliders size={13} /> VLC Effects & Equalizer <ArrowUpRight size={12} />
                      </button>
                    </div>
                  )}
                </> : <div className="source-assurance"><span><ShieldCheck size={15} /> Stays on your device</span><span>No file size limit</span></div>}
              </div>
              <div className="source-panel-footer"><span className="source-device"><Monitor size={15} /> {file ? 'Source on this device' : 'Your device is the source'}</span>{file ? <button className="loop-control" role="switch" aria-checked={loop} onClick={() => setLoop((value) => !value)}><span className={`mini-switch${loop ? ' on' : ''}`} /> Loop video</button> : <span className="local-only"><span /> LOCAL ONLY</span>}</div>
            </div>

            <div className="share-panel interactive-panel">
              <div className="panel-heading"><div className="panel-title"><span className="step-number">02</span><h2>Share your stream</h2></div><Link2 size={18} className="panel-heading-icon" /></div>
              <div className="share-body">
                <div className="mode-tabs" role="tablist" aria-label="Stream link type" onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'browser' : event.key === 'End' ? 'vlc' : mode === 'browser' ? 'vlc' : 'browser'; setMode(next); setCopied(false); document.getElementById(`share-tab-${next}`)?.focus(); } }}>
                  {(['browser', 'vlc'] as const).map((option) => <button key={option} id={`share-tab-${option}`} className={mode === option ? 'active' : ''} role="tab" tabIndex={mode === option ? 0 : -1} aria-selected={mode === option} aria-controls="share-mode-content" onClick={() => { setMode(option); setCopied(false); }}>{mode === option && <motion.span className="mode-active-background" layoutId="active-share-mode" transition={{ type: 'spring', stiffness: 420, damping: 35 }} />}<span className="mode-label">{option === 'browser' ? <Monitor size={16} /> : <VlcIcon size={17} />}{option === 'browser' ? 'Browser' : 'VLC player'}</span></button>)}
                </div>
                <div id="share-mode-content" role="tabpanel" aria-labelledby={`share-tab-${mode}`}>
                  <p className="mode-description">{mode === 'browser' ? 'One link. A direct connection.' : 'Original video. Your favorite player.'}</p>
                  <div className="link-label-row"><label htmlFor="stream-link">{mode === 'browser' ? 'YOUR STREAM LINK' : 'YOUR VLC STREAM URL'}</label>{mode === 'browser' && host.link && <a href={host.link} target="_blank" rel="noreferrer" className="text-link">Open link <ArrowUpRight size={12} /></a>}</div>
                  <div className={`link-field${canCopy ? ' has-link' : ''}`}><Link2 size={16} className="link-field-icon" /><input id="stream-link" readOnly={mode === 'browser'} value={mode === 'browser' ? host.link : vlcUrl} placeholder={mode === 'browser' ? 'Your link will appear here' : 'Paste the URL from the helper'} aria-label={mode === 'browser' ? 'Browser stream link' : 'HTTP stream URL for VLC'} spellCheck={false} autoComplete="off" onChange={(event) => { if (mode === 'vlc') { setVlcUrl(event.target.value); setCopied(false); } }} /><button className={`copy-link${copied ? ' is-copied' : ''}`} disabled={!canCopy} onClick={() => void copyLink()} aria-label={copied ? 'Link copied' : 'Copy stream link'} title="Copy link">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div>
                  <p className="link-hint">{mode === 'browser' ? isLive ? 'Ready to share. Your link is live while you are.' : isConnecting ? 'Making a little room for a direct connection...' : file ? videoError ? 'Use the VLC option for this video format.' : ready ? 'Your video is ready. Give it a link.' : 'Loading your local video...' : 'Choose a video to get things flowing.' : vlcUrl && !hasVlcLink ? 'Enter a full http:// or https:// URL.' : hasVlcLink ? 'Link added. Make sure the source helper is running.' : 'The local helper prints this URL when it starts.'}</p>
                  {mode === 'browser' ? <button className={`button create-link-button${isLive ? ' button-stop' : ' button-primary'}`} disabled={isConnecting || (Boolean(file) && !ready && !videoError)} onClick={startOrStop}>{isConnecting ? <LoaderCircle size={18} className="spin" /> : isLive ? <Square size={14} fill="currentColor" /> : <Link2 size={18} />}<span>{isConnecting ? 'Creating your link...' : isLive ? 'Stop sharing' : videoError ? 'Set up VLC instead' : 'Create stream link'}</span>{!isConnecting && !isLive && <ArrowUpRight size={19} className="button-trailing-icon" />}</button> : <button className="button button-primary create-link-button" onClick={() => hasVlcLink ? downloadPlaylist() : setGuide('vlc')}>{hasVlcLink ? <Download size={17} /> : <VlcIcon size={19} />}<span>{hasVlcLink ? 'Download VLC playlist' : 'Set up VLC streaming'}</span><ArrowUpRight size={19} className="button-trailing-icon" /></button>}
                  <div className="sharing-reminder"><span className="reminder-icon">{mode === 'browser' ? <ShieldCheck size={21} strokeWidth={1.5} /> : <VlcIcon size={23} />}</span><div><h3>{mode === 'browser' ? 'You are the source.' : 'A little helper. A real URL.'}</h3><p>{mode === 'browser' ? 'Keep this tab open and your device awake. Your video streams directly from here.' : 'VLC needs an HTTP stream. Run the helper on the device with your video. No uploads needed.'}</p><button className="text-link reminder-link" onClick={() => setGuide(mode === 'browser' ? 'privacy' : 'vlc')}>{mode === 'browser' ? 'Private by design' : 'View the setup guide'} <ArrowUpRight size={13} /></button></div></div>
                </div>
              </div>
              <div className="share-panel-footer"><span className={`status-dot${isLive ? ' is-live' : isConnecting ? ' is-connecting' : ''}`} />{isLive ? <><span>Browser stream is live</span><span className="viewer-count">{host.viewers} watching</span></> : <span>{isConnecting ? 'Connecting your device' : mode === 'vlc' && hasVlcLink ? 'VLC link added, not verified' : 'Ready when you are'}</span>}</div>
            </div>
          </motion.section>

          <motion.div className="workspace-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.4 }}><div><Info size={15} /><span>Browser links are made for browsers. Using VLC? We've got a helper for that.</span></div><button className="text-link" onClick={() => setGuide('vlc')}>See how <ArrowUpRight size={13} /></button></motion.div>

          <motion.section id="how-it-works" className="how-section" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5 }} aria-labelledby="how-title">
            <div className="how-intro"><span className="eyebrow">SIMPLE BY NATURE</span><h2 id="how-title">Less cloud.<br />{' '}More connection.</h2><button className="text-link" onClick={() => setGuide('start')}>How Relay works <ArrowUpRight size={14} /></button></div>
            <div className="how-step"><span className="how-number">01 <span /></span><h3>Pick your video.</h3><p>Big or small, your file stays right where it belongs. On your device.</p></div>
            <div className="how-step"><span className="how-number">02 <span /></span><h3>Pass along a link.</h3><p>Connect directly in a browser, or use the local helper for VLC.</p></div>
            <div className="how-step"><span className="how-number">03</span><h3>Keep the moment going.</h3><p>Stay connected while they watch. Stop sharing whenever you like.</p></div>
          </motion.section>
        </main>

        <footer className="site-footer"><div className="footer-inner"><div className="footer-brand"><Brand compact /><span>A direct way to share.</span></div><div className="footer-links"><button onClick={() => setGuide('privacy')}>Privacy & limits</button><button onClick={() => setGuide('github')}><CodeXml size={15} /> GitHub Pages ready <ArrowUpRight size={12} /></button></div></div></footer>
      </div>}

      <AnimatePresence>{guide && <GuideModal tab={guide} setTab={setGuide} onClose={closeGuide} filename={file?.name} onImportVlc={importVlc} />}</AnimatePresence>
      <AnimatePresence>
        {showVlcEffects && (
          <VlcExtendedModal
            onClose={() => setShowVlcEffects(false)}
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
      </AnimatePresence>
      <AnimatePresence>{toast && <motion.div key={toast.id} className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} initial={{ opacity: 0, y: 15, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}>{toast.kind === 'success' ? <CircleCheck size={20} /> : <CircleAlert size={20} />}<span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={16} /></button></motion.div>}</AnimatePresence>
    </MotionConfig>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowDownToLine, ArrowUpRight, BookOpen, Check, CodeXml, Copy, Download, ExternalLink, LockKeyhole, MonitorPlay, Sliders, X } from 'lucide-react';
import helperSource from '../assets/relay-stream.py?raw';
import guideSource from '../../README.md?raw';
import { copyText, downloadText } from '../lib/utils';
import { VlcIcon } from './Brand';

export type GuideTab = 'start' | 'vlc' | 'codecs' | 'github' | 'privacy';

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timeout = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timeout.current), []);
  const copy = async () => {
    try {
      await copyText(code);
      setCopied(true);
      setFailed(false);
      window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setFailed(true);
    }
  };
  return (
    <div className="code-block">
      <pre><code>{code}</code></pre>
      <button className="code-copy" onClick={() => void copy()} aria-label={copied ? 'Command copied' : 'Copy command'} title="Copy command">
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      {failed && <span className="code-error">Select the command and copy it manually.</span>}
    </div>
  );
}

function GuideStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section className="guide-step">
      <span className="guide-step-number">{number}</span>
      <div><h3>{title}</h3>{children}</div>
    </section>
  );
}

export function GuideModal({ tab, setTab, onClose, filename, onImportVlc }: {
  tab: GuideTab;
  setTab: (tab: GuideTab) => void;
  onClose: () => void;
  filename?: string;
  onImportVlc: (url: string) => boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [platform, setPlatform] = useState<'mac' | 'windows'>('mac');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState(false);
  const safeName = (filename || 'video.mp4').replace(/[^a-zA-Z0-9 ._-]/g, '_');
  const command = platform === 'mac'
    ? `python3 relay-stream.py "/full/path/to/${safeName}"`
    : `py relay-stream.py "C:\\Videos\\${safeName}"`;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), a[href], input:not(:disabled), [tabindex="0"]');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  const importUrl = () => {
    if (onImportVlc(url.trim())) onClose();
    else setUrlError(true);
  };

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div ref={dialogRef} className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" initial={{ opacity: 0, y: 25, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 15 }} transition={{ duration: 0.23 }} onClick={(event) => event.stopPropagation()}>
        <div className="guide-header">
          <div className="guide-heading"><span className="guide-book"><BookOpen size={23} /></span><div><h2 id="guide-title">A little guidance. A lot of possibility.</h2><p>Your step-by-step Relay handbook.</p></div></div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close setup guide"><X size={21} /></button>
        </div>
        <div className="guide-tabs" role="tablist" aria-label="Setup topics" onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const tabs: GuideTab[] = ['start', 'vlc', 'codecs', 'github', 'privacy'];
          const offset = event.key === 'ArrowRight' ? 1 : -1;
          const next = event.key === 'Home' ? 'start' : event.key === 'End' ? 'privacy' : tabs[(tabs.indexOf(tab) + offset + tabs.length) % tabs.length];
          setTab(next);
          document.getElementById(`guide-tab-${next}`)?.focus();
        }}>
          {([
            ['start', 'Quick start', <MonitorPlay size={16} />],
            ['vlc', 'VLC streaming', <VlcIcon size={17} />],
            ['codecs', 'Codecs & Audio', <Sliders size={15} />],
            ['github', 'GitHub Pages', <CodeXml size={16} />],
            ['privacy', 'Privacy & limits', <LockKeyhole size={15} />],
          ] as [GuideTab, string, ReactNode][]).map(([id, label, icon]) => (
            <button key={id} role="tab" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} aria-controls={`guide-panel-${id}`} id={`guide-tab-${id}`} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{icon}{label}</button>
          ))}
        </div>
        <div key={tab} className="guide-body" role="tabpanel" id={`guide-panel-${tab}`} aria-labelledby={`guide-tab-${tab}`} tabIndex={0}>
          {tab === 'start' && <>
            <div className="guide-intro"><span className="eyebrow">START HERE</span><h2>From your device to theirs.</h2><p>No accounts. No uploading. Just a video and a direct connection.</p></div>
            <GuideStep number="01" title="Choose the video you want to share."><p>Drop a file into Relay or select <strong>Choose a video</strong>. Use Chrome or Edge as the source browser for the best experience. An H.264/AAC MP4 or WebM is a good starting point.</p></GuideStep>
            <GuideStep number="02" title="Create a link. Make a connection."><p>Select <strong>Browser</strong>, then <strong>Create stream link</strong>. Copy the link and send it to someone. They open it in their browser and enable sound if needed. A maximum of four viewers can join.</p></GuideStep>
            <GuideStep number="03" title="You're in control of the playback."><p>The source player controls pause, seeking, and looping. Viewers join at the current point in the video. Keep your tab open and device awake. <strong>Stop sharing</strong> immediately ends the session.</p></GuideStep>
            <p className="guide-fineprint">Running locally? A localhost link only opens on the same device. Publish the page on GitHub Pages before sending browser links to other devices.</p>
            <div className="guide-note"><strong>A browser link is not a VLC link.</strong><p>GitHub Pages cannot run a server on your device. Browser links use WebRTC; VLC needs an HTTP URL from the local helper.</p><button className="text-link" onClick={() => setTab('vlc')}>Show me the VLC setup <ArrowUpRight size={15} /></button></div>
            <p className="guide-fineprint">Direct WebRTC connections may fail on restrictive networks. PeerJS provides signaling, and STUN discovers the route. No TURN media relay is configured. Try the same Wi-Fi if a connection cannot be established.</p>
          </>}

          {tab === 'vlc' && <>
            <div className="guide-intro"><span className="eyebrow">FOR YOUR FAVORITE PLAYER</span><h2>A real URL. Ready for VLC.</h2><p>A tiny local helper streams the original file, with no copy and no upload.</p></div>
            <GuideStep number="01" title="Get Python and the streaming helper."><p>Install <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer">Python 3.8+ <ExternalLink size={12} /></a> if you don't have it, then download the helper. No extra Python packages are needed.</p><button className="button button-secondary helper-download" onClick={() => downloadText(helperSource, 'relay-stream.py', 'text/x-python')}><Download size={16} /> Download helper <span>.py</span></button></GuideStep>
            <GuideStep number="02" title="Run it on the device with your video."><p>Open a terminal in the folder where you downloaded the helper. Replace the example path below with your video's <strong>actual full path</strong>. Selecting a file in a browser cannot reveal its filesystem path.</p><div className="platform-switch"><button className={platform === 'mac' ? 'active' : ''} onClick={() => setPlatform('mac')}>macOS / Linux</button><button className={platform === 'windows' ? 'active' : ''} onClick={() => setPlatform('windows')}>Windows</button></div><CodeBlock code={command} /><p className="guide-fineprint">On Windows, allow Python through the firewall for private networks only. If the port is busy, add <code>--port 8766</code>. If the IP is incorrect, add <code>--advertise YOUR_LAN_IP</code>.</p></GuideStep>
            <GuideStep number="03" title="Copy the printed URL into VLC."><p>Connect both devices to the same trusted Wi-Fi or a trusted private VPN. In <a href="https://www.videolan.org/vlc/" target="_blank" rel="noreferrer">VLC <ExternalLink size={12} /></a>, choose <strong>Media &gt; Open Network Stream</strong> (Ctrl+N), or <strong>File &gt; Open Network</strong> on macOS. Paste the HTTP URL and play.</p><p>You can also add the printed URL to Relay to copy it or download a VLC playlist:</p><div className="import-url"><input aria-label="HTTP URL printed by the streaming helper" type="url" placeholder="http://192.168.1.42:8765/stream/..." value={url} onChange={(event) => { setUrl(event.target.value); setUrlError(false); }} onKeyDown={(event) => { if (event.key === 'Enter') importUrl(); }} /><button className="button button-primary" onClick={importUrl}>Use link <ArrowUpRight size={16} /></button></div>{urlError && <p className="field-error">Enter a complete http:// or https:// URL from the helper.</p>}</GuideStep>
            <div className="guide-note"><strong>Keep the terminal open, not necessarily the website.</strong><p>Ctrl+C stops sharing. The helper reads the original file in small chunks and supports seeking. HTTP is not encrypted: only use a trusted LAN or secured private VPN, and never expose this helper directly to the public internet.</p></div>
          </>}

          {tab === 'codecs' && <>
            <div className="guide-intro"><span className="eyebrow">VLC-GRADE PLAYBACK</span><h2>All Codecs & Audio Track Selection</h2><p>How Relay inspects files, routes multi-track audio, and handles all media formats.</p></div>
            <GuideStep number="01" title="Multi-Audio Track Selection."><p>Videos with multiple audio streams (e.g. English, Spanish, Japanese dubs, or director's commentary) are automatically detected. Click the <strong>Audio Track icon</strong> on the player toolbar or open <strong>VLC Effects</strong> to switch between streams.</p></GuideStep>
            <GuideStep number="02" title="10-Band Equalizer & 200% Volume Boost."><p>Relay includes a real-time Web Audio DSP pipeline with a <strong>10-Band Graphic Equalizer</strong> (32Hz to 16kHz) and 18 standard VLC presets (Rock, Pop, Full Bass, Live, Movie, etc.), plus pre-amp gain and volume boosting up to <strong>200%</strong> with soft peak limiting.</p></GuideStep>
            <GuideStep number="03" title="Audio & Subtitle Delay Synchronization."><p>If audio or subtitles are slightly out of sync with video frames, use the delay synchronization sliders or keyboard shortcuts (<code>j/k</code> for audio delay, <code>g/h</code> for subtitle delay) to adjust timing in real-time.</p></GuideStep>
            <GuideStep number="04" title="Universal Codec Support & VLC Mode."><p>Standard MP4 (H.264, AV1, VP9), WebM, MOV, and MKV files play natively with hardware acceleration. For ultra-exotic codecs (like MPEG-2, VC-1, DTS-HD, or DivX), the <strong>VLC Stream Helper</strong> streams the raw bytes with full Range support for bit-perfect playback in VLC.</p></GuideStep>
          </>}

          {tab === 'github' && <>
            <div className="guide-intro"><span className="eyebrow">YOUR OWN CORNER OF THE WEB</span><h2>Make yourself at home on GitHub Pages.</h2><p>One static website. No hosting bill. No video files in your repository.</p></div>
            <GuideStep number="01" title="Install and build the project."><p>Install <a href="https://nodejs.org/" target="_blank" rel="noreferrer">Node.js 22 or 24 <ExternalLink size={12} /></a>. Download the project files, open a terminal in the project folder, and run:</p><CodeBlock code={'npm install\nnpm run dev'} /><p>The local site usually opens at <code>http://localhost:5173</code>. When you are ready to publish, build the static HTML:</p><CodeBlock code="npm run build" /></GuideStep>
            <GuideStep number="02" title="Upload the built page to a repository."><p>Create a public GitHub repository, such as <code>relay</code>. Upload the contents of <code>dist</code> to its root. Your <strong>index.html must be at the repository root</strong>, not inside a folder named dist. The guide and helper are embedded in that page.</p></GuideStep>
            <GuideStep number="03" title="Switch on GitHub Pages."><p>Go to <strong>Settings &gt; Pages</strong>. Choose <strong>Deploy from a branch</strong>, select <strong>main</strong> and <strong>/ (root)</strong>, then save. Wait for deployment, enable HTTPS, and visit:</p><CodeBlock code="https://YOUR_USERNAME.github.io/relay/" /></GuideStep>
            <div className="guide-note"><strong>Prefer automatic deployment?</strong><p>Push the full source project, including <code>.github/workflows/deploy.yml</code> and the lockfile, to main. Set <strong>Settings &gt; Pages &gt; Source</strong> to <strong>GitHub Actions</strong>. Push a change or run the included deployment workflow.</p></div>
            <p className="guide-fineprint">GitHub Pages hosts the interface only. PeerJS is an external signaling dependency. Your video is never deployed, and the VLC helper runs on your source device, not GitHub.</p>
          </>}

          {tab === 'privacy' && <>
            <div className="guide-intro"><span className="eyebrow">A FEW THINGS WORTH KNOWING</span><h2>Local first. Honest always.</h2><p>Here's what stays private, and where the practical limits are.</p></div>
            <GuideStep number="01" title="Your original video stays on your device."><p>Relay does not upload videos or save them in cloud storage. The selected file and browser session exist only in this tab's memory. Recipients necessarily buffer media and can record it; no player can guarantee that nothing is stored by a viewer.</p></GuideStep>
            <GuideStep number="02" title="Browser streams are encrypted, not anonymous."><p>WebRTC encrypts media between peers. PeerJS and STUN exchange connection metadata, and connected peers can learn each other's IP addresses. GitHub Pages may log visits under GitHub's privacy policy. No TURN media relay or analytics is configured by this app.</p></GuideStep>
            <GuideStep number="03" title="A link is an invitation. Share it carefully."><p>Anyone with a link can watch while the source is active. Browser links have a random session key. The VLC helper generates a new secret URL every run, but HTTP is unencrypted and should only be used on trusted networks. Stopping the source invalidates the session.</p></GuideStep>
            <GuideStep number="04" title="Always source-dependent."><p>Browser sharing requires a supported source browser, an open tab, and a successful direct network route. It streams real-time playback, not independent on-demand copies. VLC sharing requires the local Python helper and a reachable source address. Neither mode works after the source device turns off.</p></GuideStep>
          </>}
        </div>
        <div className="guide-footer"><span>Good things come with good instructions.</span><button className="text-link" onClick={() => downloadText(guideSource, 'relay-setup-guide.md', 'text/markdown')}><ArrowDownToLine size={15} /> Download full guide</button></div>
      </motion.div>
    </motion.div>
  );
}
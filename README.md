# Relay

A local-first video-sharing app that can be hosted on GitHub Pages. The original video stays on the source device. Relay does not upload videos to GitHub, a media server, or cloud storage.

## Important: Browser Links and VLC Links Are Different

GitHub Pages only serves static HTML, CSS, and JavaScript. A browser cannot create an HTTP server on your device, and a local `blob:` URL is not accessible to another device or VLC.

Relay provides two real options:

| Mode | How it works | Where to open the link |
| --- | --- | --- |
| Browser | A direct, encrypted WebRTC stream of the source player's playback | Another modern browser |
| VLC | A small Python HTTP helper reads the original video from your device | VLC's Open Network Stream, on a reachable trusted network |

The source device must remain powered on and connected. Browser mode requires the sender's tab to stay open. VLC mode requires the helper's terminal to stay open, but the website can be closed.

## 1. Install and Run the Website Locally

Install Node.js 22 or 24 from https://nodejs.org. Download this project's files, extract them, and open a terminal in the project folder.

```sh
npm install
npm run dev
```

Open the local address printed in your terminal, usually `http://localhost:5173`. Chrome or Edge is recommended for sending browser streams. Current Firefox also supports media-element capture, with browser-specific limitations. Safari can watch compatible WebRTC streams but does not support the source capture method used here; use Chrome or the VLC helper to send.

Links inherit the address of the page you are using. A `localhost` link only opens on the same device. Publish to GitHub Pages before sharing browser links with other devices, or provide your own appropriately secured and reachable frontend hosting.

## 2. Share a Video in a Browser

1. Choose a video or drop it into the source area. Relay supports MP4, WebM, MKV, MOV, and common video containers. The integrated media parser inspects video codecs, audio tracks, and subtitles.
2. Select Browser and click Create stream link. Playback starts on your source device, muted locally by default.
3. Copy the generated link and send it to a viewer. The viewer opens it in a browser and clicks Enable sound if needed.
4. Keep the sender's tab open and the device awake. The source player controls what everyone sees, including pause, seek, and loop. A viewer joins at the current playback position rather than starting an independent copy.
5. Click Stop sharing to end the session and invalidate its link. Changing or removing the source also ends sharing. Up to four viewers can connect, subject to your device's performance and upload bandwidth.

## 3. VLC-Grade Playback, Audio Selection & Equalizer

Relay includes a full-featured web player modeled after VLC:

- **Audio Track Selection**: Switch between multiple audio streams (e.g. English, Japanese dubs, director's commentary) with one click from the player toolbar.
- **10-Band Graphic Equalizer**: Standard VLC frequencies (32Hz to 16kHz) with 18 presets (Flat, Rock, Pop, Classical, Full Bass, Live, Movie, etc.) and pre-amp gain.
- **200% Volume Boost**: Boost quiet media up to 200% with a built-in dynamics compressor / soft limiter to prevent clipping.
- **Audio & Subtitle Delay Sync**: Adjust timing in milliseconds (`j/k` for audio delay, `g/h` for subtitle delay) to fix out-of-sync audio.
- **Stereo Matrix Modes**: Original Stereo, Mono Downmix, Left Channel, Right Channel, and Reverse Stereo.
- **Video Adjustments**: Brightness, Contrast, Saturation, Gamma, Hue, Sepia, Invert, Aspect Ratio (16:9, 4:3, 21:9, 1:1, Fill), Rotation (90°/180°/270°), and Horizontal/Vertical Flip.
- **Subtitles & Closed Captions**: Load external `.srt`, `.vtt`, `.ass`, or `.sub` files with custom sizing and real-time synchronization.
- **VLC Codec Inspector**: View container metadata, video stream codecs, resolution, framerate, audio streams, and browser playability breakdown.

Browser mode uses the public PeerJS signaling service and STUN to discover a direct route. These services exchange connection metadata; the video is sent over WebRTC between the devices. No TURN media relay is configured. Some mobile, corporate, and restrictive NAT networks cannot establish a direct route. Try the same Wi-Fi network or the VLC helper on a trusted reachable network. This is not a promise that every pair of internet connections will work.

## 3. Stream Directly to VLC Without Uploading

Install Python 3.8 or newer from https://www.python.org/downloads/ and VLC from https://www.videolan.org/vlc/. On Windows, enable Add Python to PATH during installation if offered.

1. In Relay, open the VLC player tab, then Set up VLC streaming.
2. Download `relay-stream.py` using the Download helper button. The helper has no package dependencies. Its source is in `src/assets/relay-stream.py`.
3. Open a terminal in the folder containing the downloaded helper. Run it with the full path to the original video. The browser cannot obtain a real filesystem path from a selected file, so this path must be supplied manually.

macOS or Linux:

```sh
python3 relay-stream.py "/full/path/to/video.mp4"
```

Windows:

```powershell
py relay-stream.py "C:\Videos\video.mp4"
```

4. Allow Python through your firewall for your private network only, if prompted. Do not disable the firewall. Both devices should be on the same trusted Wi-Fi or connected through an existing trusted VPN. Guest Wi-Fi client isolation can prevent connections.
5. Copy the HTTP URL printed in the terminal. It will resemble `http://192.168.1.42:8765/stream/RANDOM_PRIVATE_TOKEN/video.mp4`. Use the source device's LAN address, not `localhost`, on another device. The helper also prints a loopback URL for VLC on the same device.
6. On the viewer, open VLC, choose Media > Open Network Stream (Ctrl+N on Windows/Linux; File > Open Network on macOS), paste the full URL, and select Play. You can also paste this URL into Relay's VLC tab to copy it or download a small `.m3u` playlist. The website does not probe or verify that the helper is running.
7. Keep the terminal and source device running. Ctrl+C stops the server. Each run generates a new private token, so old links are no longer valid.

The helper serves only the one chosen file. It supports HTTP byte-range requests for seeking, reads in bounded chunks, disables HTTP caching, and does not create a copy, upload, or transcode the video. Viewers can play independently of the browser source player.

If the network adapter was detected incorrectly or you are using a trusted VPN, specify the reachable source address:

```sh
python3 relay-stream.py "/full/path/to/video.mp4" --advertise 192.168.1.42
```

If port 8765 is busy:

```sh
python3 relay-stream.py "/full/path/to/video.mp4" --port 8766
```

HTTP is not encrypted. Use the helper only on a trusted private network or an appropriately secured private VPN. Do not expose it directly to the public internet. An unguessable URL is not a substitute for transport encryption. To reach a source outside your local network, you need a reachable, secured network route; GitHub Pages cannot provide it.

## 4. Host on GitHub Pages

The website is entirely static. The existing build setup bundles JavaScript and CSS into `dist/index.html`, so it works on GitHub Pages project URLs as well as a custom domain. Video files must not be added to your repository.

### Option A: Upload the Built HTML

1. In the project folder, run:

```sh
npm install
npm run build
```

2. Create a new public GitHub repository, for example `relay`.
3. Upload the contents of the `dist` folder to the repository root. Upload `index.html` directly; do not upload a folder named `dist` containing it. The Python helper and this guide are embedded in the app, so they remain downloadable from the built page.
4. Open Settings > Pages. Under Build and deployment, choose Deploy from a branch, select `main`, choose `/ (root)`, and Save.
5. Wait for deployment. Open `https://YOUR_USERNAME.github.io/relay/`. Enable Enforce HTTPS if available. HTTPS is required for the site's clipboard and modern browser features.

### Option B: Automatic Deployment from Source

1. Push the full project, including `.github/workflows/deploy.yml` and `package-lock.json`, to your GitHub repository's `main` branch.
2. Open Settings > Pages and set Source to GitHub Actions.
3. Open Actions and run Deploy Relay to GitHub Pages, or push a change to `main`.
4. The included workflow installs dependencies, builds the website, and deploys `dist`. The Pages URL appears in the completed deployment. If your default branch is not `main`, adjust the workflow's branch trigger.

The workflow uses a relative Vite base through a command-line flag. No runtime backend, video storage, environment variables, or API keys are needed for the default browser setup. PeerJS signaling is an external availability dependency, not a server hosted by GitHub Pages.

## Privacy and Limits

- Relay keeps the selected file and session link in current-tab memory. It does not persist them in local storage or upload the video.
- Browser connections are encrypted by WebRTC. Peers can learn one another's IP addresses, and PeerJS/STUN receive connection metadata. GitHub Pages may log visitor IPs under GitHub's own privacy policy.
- A link grants access to whoever has it. Share privately. Receivers necessarily buffer media and can record or save what they can play; no app can guarantee that a viewer stores nothing.
- The Python helper uses a per-run random URL token and HTTP `Cache-Control: no-store`. This discourages caching but cannot stop deliberate recording or saving.
- Browser mode streams decoded, real-time playback and may re-encode it for WebRTC. It is not a permanent file URL, an independent on-demand copy, or a VLC-compatible URL.
- VLC mode streams original file bytes. Codec support is determined by VLC. It requires Python and a reachable source device, not just a static webpage.
- Closing, refreshing, or sleeping the sender's browser ends or interrupts browser sharing. Stopping the helper or sleeping the source device interrupts VLC sharing.

## Project Files

- `src/App.tsx`: source workspace and sharing controls.
- `src/hooks/useHostStream.ts`: direct WebRTC source sessions.
- `src/components/WatchView.tsx`: browser receiver.
- `src/components/GuideModal.tsx`: installation and privacy tutorials.
- `src/assets/relay-stream.py`: no-upload, single-file HTTP server for VLC.
- `.github/workflows/deploy.yml`: GitHub Pages deployment.
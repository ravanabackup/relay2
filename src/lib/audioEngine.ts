// VLC 10-Band Equalizer Standard Frequencies
export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export type EqPresetName =
  | 'Flat'
  | 'Classical'
  | 'Club'
  | 'Dance'
  | 'Full Bass'
  | 'Full Bass & Treble'
  | 'Full Treble'
  | 'Headphones'
  | 'Large Hall'
  | 'Live'
  | 'Party'
  | 'Pop'
  | 'Reggae'
  | 'Rock'
  | 'Ska'
  | 'Soft'
  | 'Techno'
  | 'Vocal / Voice'
  | 'Movie / Cinema';

export const VLC_EQ_PRESETS: Record<EqPresetName, number[]> = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Classical': [4.8, 3.8, 3.0, 2.5, -1.5, -1.5, 0, 2.5, 3.8, 4.2],
  'Club': [0, 0, 2.0, 3.5, 3.5, 3.5, 2.0, 0, 0, 0],
  'Dance': [7.0, 5.5, 2.0, 0, 0, -3.5, -4.5, -4.5, 0, 0],
  'Full Bass': [7.8, 7.8, 7.8, 4.5, 1.0, -3.2, -6.5, -8.0, -8.5, -9.0],
  'Full Bass & Treble': [5.5, 4.0, 0, -5.0, -3.5, 1.0, 6.0, 8.5, 9.0, 9.0],
  'Full Treble': [-8.0, -8.0, -8.0, -3.5, 2.0, 8.0, 11.0, 11.0, 11.5, 12.0],
  'Headphones': [3.5, 8.0, 4.0, -2.5, -1.8, 1.0, 3.5, 6.5, 9.0, 10.0],
  'Large Hall': [7.5, 7.5, 4.0, 4.0, 0, -3.5, -3.5, -3.5, 0, 0],
  'Live': [-3.5, 0, 2.5, 3.5, 4.0, 4.0, 2.5, 1.8, 1.8, 1.5],
  'Party': [5.5, 5.5, 0, 0, 0, 0, 0, 0, 5.5, 5.5],
  'Pop': [-1.5, 1.0, 4.5, 5.5, 4.0, -1.0, -2.0, -2.0, -1.5, -1.5],
  'Reggae': [0, 0, 0, -4.0, 0, 4.5, 4.5, 0, 0, 0],
  'Rock': [6.0, 3.5, -4.0, -6.0, -2.5, 3.0, 6.5, 8.5, 8.5, 8.5],
  'Ska': [-2.0, -3.5, -3.0, 0, 3.0, 4.0, 6.5, 6.5, 8.0, 7.0],
  'Soft': [3.5, 1.0, 0, -1.5, 0, 3.0, 6.0, 7.5, 8.5, 9.5],
  'Techno': [6.0, 4.5, 0, -4.0, -3.5, 0, 6.0, 7.0, 7.0, 6.5],
  'Vocal / Voice': [-2.0, -3.5, -3.5, 1.0, 4.5, 4.5, 3.0, 1.5, 0, -2.0],
  'Movie / Cinema': [4.0, 2.5, 1.0, -1.0, 0, 1.0, 2.5, 4.0, 5.5, 6.0],
};

export type StereoMode = 'stereo' | 'mono' | 'left' | 'right' | 'reverse';

export interface AudioEngineState {
  isInitialized: boolean;
  volumePercent: number; // 0% to 200%
  isMuted: boolean;
  preampDb: number; // -20dB to +20dB
  bands: number[]; // 10 band gain values in dB
  activePreset: EqPresetName;
  isEqEnabled: boolean;
  stereoMode: StereoMode;
  audioDelayMs: number; // -5000 to +5000
  currentAudioTrack: number; // 0-indexed
  availableAudioTracksCount: number;
}

export class VlcAudioEngine {
  private ctx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private preampGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private splitterNode: ChannelSplitterNode | null = null;
  private mergerNode: ChannelMergerNode | null = null;
  private stereoGains: {
    ll: GainNode;
    lr: GainNode;
    rl: GainNode;
    rr: GainNode;
  } | null = null;

  private connectedVideo: HTMLVideoElement | null = null;
  private state: AudioEngineState = {
    isInitialized: false,
    volumePercent: 100,
    isMuted: false,
    preampDb: 0,
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    activePreset: 'Flat',
    isEqEnabled: true,
    stereoMode: 'stereo',
    audioDelayMs: 0,
    currentAudioTrack: 0,
    availableAudioTracksCount: 1,
  };

  private listeners: Set<(state: AudioEngineState) => void> = new Set();

  public getState(): AudioEngineState {
    return { ...this.state, bands: [...this.state.bands] };
  }

  public subscribe(fn: (state: AudioEngineState) => void): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }

  public attach(video: HTMLVideoElement) {
    if (this.connectedVideo === video && this.ctx) return;
    this.connectedVideo = video;

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.ctx) {
        this.ctx = new AudioContextClass();
      }

      if (this.ctx.state === 'suspended') {
        const resume = () => {
          this.ctx?.resume();
          window.removeEventListener('click', resume);
          window.removeEventListener('keydown', resume);
        };
        window.addEventListener('click', resume, { once: true });
        window.addEventListener('keydown', resume, { once: true });
      }

      // Check if sourceNode was already created for this video element
      if (!this.sourceNode) {
        try {
          this.sourceNode = this.ctx.createMediaElementSource(video);
        } catch {
          // If already connected in a prior cycle, proceed
          return;
        }
      }

      this.buildGraph();
      this.state.isInitialized = true;
      this.syncNativeAudioTracks();
      this.notify();
    } catch {
      // AudioContext fallback
    }
  }

  private buildGraph() {
    if (!this.ctx || !this.sourceNode) return;

    // 1. Preamp Gain
    this.preampGainNode = this.ctx.createGain();
    this.preampGainNode.gain.value = this.dbToLinear(this.state.preampDb);

    // 2. 10-Band Equalizer Filters
    this.eqFilters = EQ_FREQUENCIES.map((freq) => {
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.414;
      filter.gain.value = 0;
      return filter;
    });

    // 3. Audio Delay Node (for VLC audio track sync)
    this.delayNode = this.ctx.createDelay(5.0);
    this.delayNode.delayTime.value = Math.max(0, this.state.audioDelayMs / 1000);

    // 4. Stereo Matrix Router (Channel Splitter & Merger)
    this.splitterNode = this.ctx.createChannelSplitter(2);
    this.mergerNode = this.ctx.createChannelMerger(2);

    this.stereoGains = {
      ll: this.ctx.createGain(),
      lr: this.ctx.createGain(),
      rl: this.ctx.createGain(),
      rr: this.ctx.createGain(),
    };

    // 5. Dynamics Compressor (Soft Limiter for Volume Boost up to 200%)
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.value = -3.0; // dB
    this.compressorNode.knee.value = 12.0;
    this.compressorNode.ratio.value = 8.0;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.15;

    // 6. Master Volume / Boost Gain
    this.masterGainNode = this.ctx.createGain();
    this.updateMasterGain();

    // CONNECT THE CHAIN
    // Source -> Preamp -> EQ Filter 0 -> ... -> EQ Filter 9 -> Delay -> Splitter
    let previousNode: AudioNode = this.preampGainNode;
    this.sourceNode.connect(this.preampGainNode);

    this.eqFilters.forEach((filter) => {
      previousNode.connect(filter);
      previousNode = filter;
    });

    previousNode.connect(this.delayNode);
    this.delayNode.connect(this.splitterNode);

    // Matrix gains routing:
    // L channel -> ll -> Merger L, lr -> Merger R
    // R channel -> rl -> Merger L, rr -> Merger R
    this.splitterNode.connect(this.stereoGains.ll, 0);
    this.splitterNode.connect(this.stereoGains.lr, 0);
    this.splitterNode.connect(this.stereoGains.rl, 1);
    this.splitterNode.connect(this.stereoGains.rr, 1);

    this.stereoGains.ll.connect(this.mergerNode, 0, 0);
    this.stereoGains.rl.connect(this.mergerNode, 0, 0);
    this.stereoGains.lr.connect(this.mergerNode, 0, 1);
    this.stereoGains.rr.connect(this.mergerNode, 0, 1);

    this.updateStereoMatrix();

    // Merger -> Compressor -> Master Gain -> Destination
    this.mergerNode.connect(this.compressorNode);
    this.compressorNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.ctx.destination);
  }

  private updateStereoMatrix() {
    if (!this.stereoGains) return;
    const { ll, lr, rl, rr } = this.stereoGains;

    switch (this.state.stereoMode) {
      case 'stereo':
        ll.gain.value = 1;
        lr.gain.value = 0;
        rl.gain.value = 0;
        rr.gain.value = 1;
        break;
      case 'mono':
        ll.gain.value = 0.5;
        lr.gain.value = 0.5;
        rl.gain.value = 0.5;
        rr.gain.value = 0.5;
        break;
      case 'left':
        ll.gain.value = 1;
        lr.gain.value = 1;
        rl.gain.value = 0;
        rr.gain.value = 0;
        break;
      case 'right':
        ll.gain.value = 0;
        lr.gain.value = 0;
        rl.gain.value = 1;
        rr.gain.value = 1;
        break;
      case 'reverse':
        ll.gain.value = 0;
        lr.gain.value = 1;
        rl.gain.value = 1;
        rr.gain.value = 0;
        break;
    }
  }

  private updateMasterGain() {
    if (!this.masterGainNode) return;
    if (this.state.isMuted) {
      this.masterGainNode.gain.value = 0;
    } else {
      // 0% -> 0.0, 100% -> 1.0, 200% -> 2.0
      this.masterGainNode.gain.value = this.state.volumePercent / 100;
    }
  }

  public setVolume(percent: number) {
    this.state.volumePercent = Math.max(0, Math.min(200, percent));
    this.updateMasterGain();
    this.notify();
  }

  public setMuted(muted: boolean) {
    this.state.isMuted = muted;
    this.updateMasterGain();
    this.notify();
  }

  public setPreamp(db: number) {
    this.state.preampDb = Math.max(-20, Math.min(20, db));
    if (this.preampGainNode) {
      this.preampGainNode.gain.value = this.dbToLinear(this.state.preampDb);
    }
    this.notify();
  }

  public setBand(index: number, db: number) {
    if (index < 0 || index >= this.eqFilters.length) return;
    const clamped = Math.max(-20, Math.min(20, db));
    this.state.bands[index] = clamped;
    this.state.activePreset = 'Flat'; // custom modified
    if (this.state.isEqEnabled && this.eqFilters[index]) {
      this.eqFilters[index].gain.value = clamped;
    }
    this.notify();
  }

  public setPreset(name: EqPresetName) {
    const preset = VLC_EQ_PRESETS[name];
    if (!preset) return;
    this.state.activePreset = name;
    this.state.bands = [...preset];
    if (this.state.isEqEnabled) {
      this.eqFilters.forEach((filter, i) => {
        if (filter) filter.gain.value = preset[i] || 0;
      });
    }
    this.notify();
  }

  public setEqEnabled(enabled: boolean) {
    this.state.isEqEnabled = enabled;
    this.eqFilters.forEach((filter, i) => {
      if (filter) filter.gain.value = enabled ? this.state.bands[i] || 0 : 0;
    });
    this.notify();
  }

  public setStereoMode(mode: StereoMode) {
    this.state.stereoMode = mode;
    this.updateStereoMatrix();
    this.notify();
  }

  public setAudioDelayMs(ms: number) {
    this.state.audioDelayMs = Math.max(-5000, Math.min(5000, ms));
    if (this.delayNode) {
      // DelayNode supports positive delays
      this.delayNode.delayTime.value = Math.max(0, this.state.audioDelayMs / 1000);
    }
    this.notify();
  }

  public syncNativeAudioTracks() {
    if (!this.connectedVideo) return;
    // Inspect browser audioTracks API if present (Safari)
    const media = this.connectedVideo as HTMLVideoElement & {
      audioTracks?: {
        length: number;
        [index: number]: { enabled: boolean; label: string; language: string };
      };
    };

    if (media.audioTracks && media.audioTracks.length > 0) {
      this.state.availableAudioTracksCount = media.audioTracks.length;
      for (let i = 0; i < media.audioTracks.length; i++) {
        if (media.audioTracks[i].enabled) {
          this.state.currentAudioTrack = i;
          break;
        }
      }
    }
    this.notify();
  }

  public selectAudioTrack(index: number) {
    this.state.currentAudioTrack = index;
    if (this.connectedVideo) {
      const media = this.connectedVideo as HTMLVideoElement & {
        audioTracks?: {
          length: number;
          [i: number]: { enabled: boolean };
        };
      };
      if (media.audioTracks && media.audioTracks.length > index) {
        for (let i = 0; i < media.audioTracks.length; i++) {
          media.audioTracks[i].enabled = i === index;
        }
      }
    }
    this.notify();
  }

  private dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  public destroy() {
    this.listeners.clear();
    try {
      this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
    this.sourceNode = null;
    this.connectedVideo = null;
  }
}

export const globalAudioEngine = new VlcAudioEngine();

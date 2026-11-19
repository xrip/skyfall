export class RoomVoice {
  context = null;
  peers = new Map();
  microphone = null;
  pending = false;
  generation = 0;

  start() {
    try {
      this.context ??= new AudioContext();
      this.context.resume().catch(() => {});
    } catch {
      // Voice is optional on browsers without Web Audio.
    }
  }

  async attach(pc, host) {
    if (!this.context) return;
    const mix = this.context.createMediaStreamDestination();
    const track = mix.stream.getAudioTracks()[0];
    const audio = host
      ? pc.addTransceiver(track, { direction: 'sendrecv' })
      : pc.getTransceivers().find(item => item.receiver.track.kind === 'audio');
    if (!audio) {
      track.stop();
      return;
    }
    audio.direction = 'sendrecv';
    const peer = { mix, host, sender: audio.sender, source: null };
    this.peers.set(pc, peer);
    this.receive(pc, audio.receiver.track);
    if (!host) await audio.sender.replaceTrack(this.microphone?.getAudioTracks()[0] ?? track);
  }

  receive(pc, track) {
    const peer = this.peers.get(pc);
    if (!peer || track.kind !== 'audio') return;
    peer.source?.disconnect();
    const stream = new MediaStream([track]);
    // Keep browser playback active. The Web Audio graph controls audible output.
    peer.audio ??= new Audio();
    peer.audio.muted = true;
    peer.audio.srcObject = stream;
    peer.audio.play().catch(() => {});
    peer.source = this.context.createMediaStreamSource(stream);
    this.route();
  }

  route() {
    this.input?.disconnect();
    for (const peer of this.peers.values()) {
      peer.source?.disconnect();
      peer.source?.connect(this.context.destination);
    }
    for (const peer of this.peers.values()) {
      if (!peer.host) continue;
      this.input?.connect(peer.mix);
      for (const other of this.peers.values()) {
        if (other !== peer) other.source?.connect(peer.mix);
      }
    }
  }

  async enableMicrophone() {
    this.start();
    if (!this.context || !navigator.mediaDevices?.getUserMedia) throw new Error('Microphone unavailable');
    if (this.pending || this.microphone) return;
    const generation = this.generation;
    this.pending = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      for (const track of stream.getTracks()) track.enabled = false;
      if (generation !== this.generation) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      this.microphone = stream;
      this.micSource = this.context.createMediaStreamSource(stream);
      this.input = this.context.createGain();
      this.input.gain.value = 0;
      this.micSource.connect(this.input);
      this.route();
      for (const peer of this.peers.values()) {
        if (!peer.host) await peer.sender.replaceTrack(stream.getAudioTracks()[0]);
      }
    } finally {
      if (generation === this.generation) this.pending = false;
    }
  }

  talk(active) {
    for (const track of this.microphone?.getAudioTracks() || []) track.enabled = active;
    if (this.input) this.input.gain.value = Number(active);
  }

  disableMicrophone() {
    this.generation++;
    this.pending = false;
    for (const track of this.microphone?.getTracks() || []) track.stop();
    this.microphone = null;
    this.micSource?.disconnect();
    this.micSource = null;
    this.input?.disconnect();
    this.input = null;
    for (const peer of this.peers.values()) {
      if (!peer.host) peer.sender.replaceTrack(peer.mix.stream.getAudioTracks()[0]).catch(() => {});
    }
    this.route();
  }

  detach(pc) {
    const peer = this.peers.get(pc);
    if (!peer) return;
    peer.source?.disconnect();
    if (peer.audio) {
      peer.audio.pause();
      peer.audio.srcObject = null;
    }
    for (const track of peer.mix?.stream.getTracks() || []) track.stop();
    this.peers.delete(pc);
    this.route();
  }

  close() {
    this.disableMicrophone();
    for (const pc of this.peers.keys()) this.detach(pc);
    this.context?.close().catch(() => {});
    this.context = null;
  }
}

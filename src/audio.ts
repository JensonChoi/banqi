export class AudioManager {
    enabled = true;
    private context: AudioContext | null = null;
    play(kind: 'select' | 'flip' | 'move' | 'capture' | 'invalid' | 'win') {
        if (!this.enabled)
            return;
        try {
            this.context ??= new AudioContext();
            const c = this.context;
            void c.resume();
            const notes = kind === 'win' ? [392, 494, 587] : [kind === 'invalid' ? 110 : kind === 'capture' ? 170 : kind === 'flip' ? 310 : kind === 'select' ? 580 : 230];
            notes.forEach((hz, i) => {
                const at = c.currentTime + i * .13;
                const osc = c.createOscillator(), gain = c.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(hz, at);
                osc.frequency.exponentialRampToValueAtTime(hz * .55, at + .15);
                gain.gain.setValueAtTime(.0001, at);
                gain.gain.exponentialRampToValueAtTime(kind === 'select' ? .045 : .13, at + .004);
                gain.gain.exponentialRampToValueAtTime(.0001, at + .2);
                osc.connect(gain).connect(c.destination);
                osc.start(at);
                osc.stop(at + .22);
                if (kind !== 'win') {
                    const buffer = c.createBuffer(1, c.sampleRate * .055, c.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let j = 0; j < data.length; j++)
                        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / data.length * 7);
                    const source = c.createBufferSource(), filter = c.createBiquadFilter(), ng = c.createGain();
                    source.buffer = buffer;
                    filter.type = 'lowpass';
                    filter.frequency.value = 1300;
                    ng.gain.value = .09;
                    source.connect(filter).connect(ng).connect(c.destination);
                    source.start(at);
                }
            });
        }
        catch {
        }
    }
    dispose() {
        void this.context?.close();
    }
}

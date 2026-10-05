"""Synthesise a short cartoon 'meow' as a 16-bit mono WAV (stdlib only).

Run: python scripts/make-meow.py  (writes sounds/meow.wav next to this folder)
"""

import math
import random
import struct
import wave
from pathlib import Path

RATE = 44100
DURATION = 0.75
OUT = Path(__file__).resolve().parent.parent / "sounds" / "meow.wav"


def pitch(t: float) -> float:
    """Rise from 'm' to the bright 'ee-ow', then fall: the meow contour."""
    p = t / DURATION
    if p < 0.25:
        base = 520 + (880 - 520) * (p / 0.25)
    elif p < 0.55:
        base = 880 + 40 * math.sin((p - 0.25) / 0.30 * math.pi)
    else:
        base = 880 - (880 - 430) * ((p - 0.55) / 0.45) ** 1.3
    return base * (1 + 0.012 * math.sin(2 * math.pi * 6 * t))


def envelope(t: float) -> float:
    attack, release = 0.06, 0.22
    if t < attack:
        return t / attack
    if t > DURATION - release:
        return max(0.0, (DURATION - t) / release)
    return 1.0


def vowel_gain(t: float, harmonic: int) -> float:
    """Open the mouth over time: high harmonics grow from 'm' to 'ow'."""
    p = t / DURATION
    openness = min(1.0, p / 0.3) * (1 - 0.5 * max(0.0, (p - 0.6) / 0.4))
    return (1 / harmonic) * (0.25 + 0.75 * openness ** (0.4 * harmonic))


def main() -> None:
    random.seed(7)
    phase = 0.0
    frames = bytearray()
    for i in range(int(RATE * DURATION)):
        t = i / RATE
        phase += 2 * math.pi * pitch(t) / RATE
        sample = sum(vowel_gain(t, h) * math.sin(h * phase) for h in range(1, 7))
        sample += 0.015 * (random.random() - 0.5)
        value = int(max(-1.0, min(1.0, 0.55 * envelope(t) * sample)) * 32767)
        frames += struct.pack("<h", value)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(bytes(frames))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
